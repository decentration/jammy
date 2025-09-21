import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { ACTIVATION_FEE, HASH_BYTES } from "../../../risc-pvm/interpreter/host/consts";
import { nextIdInRing } from "../../../risc-pvm/interpreter/host/helpers";
import { AccEnv } from "../../../risc-pvm/interpreter/host/types";

const HEAP = 0x18000;
const GAS  = 100;

// program for ΩN new: r7=o, r8=l, r9=g, r10=m, ecalli 9, trap
function mkCode(off=HEAP, label=1, g=1000, m=2000): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  off&255, off>>8&255, off>>16&255, off>>24&255,
    Opcodes.load_imm, 8,  label&255, label>>8&255, label>>16&255, label>>24&255,
    Opcodes.load_imm, 9,  g&255, g>>8&255, g>>16&255, g>>24&255,
    Opcodes.load_imm, 10, m&255, m>>8&255, m>>16&255, m>>24&255,
    Opcodes.ecalli, 18,
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);

const mkBlob = (code: Uint8Array) =>
  buildBlob({
    meta: Uint8Array.of(0),
    jumpTbl: Uint8Array.of(0),
    z: 1,
    instr: code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });

describe("ring allocator – nextIdInRing()", () => {
  it("advances by the ring step and wraps into the valid band", () => {
    const A = 1 << 8;      // 2^8
    const B = 1 << 9;      // 2^9
    const MOD = (2 ** 32) - (1 << 9); // 2^32 - 2^9

    expect(nextIdInRing(BigInt(A))).toBe(BigInt(A + B));

    const nearEnd = A + (MOD - 10);
    const wrapped = nextIdInRing(BigInt(nearEnd));
    expect(wrapped).toBe(BigInt((A +(B - 10))));
  });
});

describe("ΩN new handler – uses ring allocator and skips taken ids", () => {
  it("picks allocator index, skips occupied id, returns next free id", () => {
    const code = mkCode();
    const blob = mkBlob(code);

    const mem = new Uint8Array(1<<20);
    const fakeHash = new Uint8Array(HASH_BYTES).fill(0xAB);
    mem.set(fakeHash, HEAP);

    const senderId = 0xffff_ffff_ffff_ffffn;

    const senderAcct = {
      storage: new Map<string, Uint8Array>(),
      preimages: new Map<string, Uint8Array>(),
      lookupStorage: new Map<string, Uint8Array>(),
      rootCodeHash: 0n,
      balance: ACTIVATION_FEE * 10n,
      gasAccumulate: 0n,
      gasOnTransfer: 0n,
      cores: new Uint8Array(0),
      selectorMap: new Map<number, any>(),
      ticketNext: 0n,
      coresOffset: 0,
      ticketIndex: 0,
    };

    const env = makeHostEnv();
    env.putService(senderId, senderAcct as any);

    env.acc = {
      allocator: {
        index: 1n << 8n,
        env: { deltas: new Map(), deleted: new Set() } as AccEnv
      },
      session: {}
    };

    const candidate1 = nextIdInRing(BigInt(env.acc.allocator.index));
    env.putService(BigInt(candidate1), { ...senderAcct, balance: 0n } as any);

    const st = runBlob(blob, GAS, { env, memInit: mem });

    const candidate2 = nextIdInRing(BigInt(candidate1));

    expect(st.registers[7]).toBe(candidate2);
    expect(env.acc.allocator.env.deltas.has(candidate2)).toBe(true);
    expect(env.acc.allocator.index).toBe(candidate2);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("returns first candidate when it is free", () => {
    const code = mkCode();
    const blob = mkBlob(code);

    const mem = new Uint8Array(1<<20);
    const fakeHash = new Uint8Array(HASH_BYTES).fill(0xCD);
    mem.set(fakeHash, HEAP);

    const senderId = 0xffff_ffff_ffff_ffffn;

    const senderAcct = {
      storage: new Map<string, Uint8Array>(),
      preimages: new Map<string, Uint8Array>(),
      lookupStorage: new Map<string, Uint8Array>(),
      rootCodeHash: 0n,
      balance: ACTIVATION_FEE * 10n,
      gasAccumulate: 0n,
      gasOnTransfer: 0n,
      cores: new Uint8Array(0),
      selectorMap: new Map<number, any>(),
      ticketNext: 0n,
      coresOffset: 0,
      ticketIndex: 0,
    };

    const env = makeHostEnv();
    env.putService(senderId, senderAcct as any);

    env.acc = {
      allocator: { index: 1n << 8n,  env: { deltas: new Map(), deleted: new Set() } as AccEnv
       },
      session: {}
    };

    const candidate1 = nextIdInRing(BigInt(env.acc.allocator.index));

    const st = runBlob(blob, GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(candidate1);
    
    expect(env.acc.allocator.env.deltas.has(candidate1)).toBe(true);
    expect(env.acc.allocator.index).toBe(candidate1);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
