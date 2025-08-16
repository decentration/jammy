import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { ACTIVATION_FEE, CASH, FULL, HASH_BYTES } from "../../../risc-pvm/interpreter/host/consts";
import { nextIdInRing, RING_START } from "../../../risc-pvm/interpreter/host/helpers";
import { HostEnvInterface, makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { AccumulateContext } from "../../../risc-pvm/interpreter/host/types";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const HEAP = 0x18000;
const GAS  = 100;
const CODE_HASH = new Uint8Array(32).fill(0xAA);


// program: load o,l,g,m,f,i then ecalli 9 (ΩN), then trap
function mkCode(
  o=HEAP, l=42, g=111, m=222, f=0, i=0
): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  o&255, o>>8&255, o>>16&255, o>>24&255,     // r7=o
    Opcodes.load_imm, 8,  l&255, l>>8&255, l>>16&255, l>>24&255,     // r8=l
    Opcodes.load_imm, 9,  g&255, g>>8&255, g>>16&255, g>>24&255,     // r9=g
    Opcodes.load_imm,10,  m&255, m>>8&255, m>>16&255, m>>24&255,     // r10=m
    Opcodes.load_imm,11,  f&255, f>>8&255, f>>16&255, f>>24&255,     // r11=f
    Opcodes.load_imm,12,  i&255, i>>8&255, i>>16&255, i>>24&255,     // r12=i
    Opcodes.ecalli, 9,                                              // ΩN
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000, 0b0000_0100, 0b0100_0001, 0b0101_0000);


function makeBlob(code: Uint8Array): Uint8Array {
  return buildBlob({
    meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
    instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask
  });
}

const mkService = (
  id: bigint, rootCodeHash: bigint, balance: bigint
) => ({
  storage:new Map(), preimages:new Map(), lookupStorage:new Map(),
  rootCodeHash, balance, gasAccumulate:0n, gasOnTransfer:0n,
  cores:new Uint8Array(0), selectorMap:new Map(),
  ticketNext: 0n, coresOffset: 0, ticketIndex: 0,
});

// helper to seed a payer (“xs”) and the accumulate context
function mkEnvWithPayer(payerId: bigint, payerBalance: bigint, opts: any = {}) {
  const env = makeHostEnv();
  env.acc = {
    allocator: {
      index: 0n,
      env: {
        currentServiceId: payerId, // xs
        root: opts.root ?? undefined,
        updates: new Map<bigint, any>(),
      }
    },
    session: {}, 
    snapshot: {}
  } as AccumulateContext;
  
  env.putService(payerId, {
    storage: new Map(),
    preimages: new Map(),
    lookupStorage: new Map(),
    rootCodeHash: 0n,
    balance: payerBalance,
    gasAccumulate: 0n,
    gasOnTransfer: 0n,
    cores: new Uint8Array(0),
    selectorMap: new Map(),
    ticketNext: 0n,
    coresOffset: 0,
    ticketIndex: 0,
  });

return env;
}

describe("ΩN newHandler (0.7.1) of gp", () => {
  it("happy-path (ring) -> creates account, debits payer, returns id", () => {
    const mem = new Uint8Array(1<<20);
    const codeHash = new Uint8Array(HASH_BYTES).fill(0xab);
    mem.set(codeHash, HEAP);

    const xs = 0x1111_2222_3333_4444n;
    const env = mkEnvWithPayer(xs, 100n);

    const blob = makeBlob(mkCode(HEAP, 7, 11,22, 0, 0)); // l,g,m,f,i
    const st = runBlob(blob, Number(GAS), { env, memInit: mem });

    const newId = st.registers[7];
    expect(newId >= RING_START).toBe(true);

    const payer = env.getService(xs)!;
    const acct  = env.getService(newId)!;

    expect(payer.balance).toBe(100n - ACTIVATION_FEE);
    expect(acct.balance).toBe(ACTIVATION_FEE);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
});

it("explicit id by root (i < S) -> returns i and uses it", () => {
  const mem = new Uint8Array(1<<20);
  const H = new Uint8Array(HASH_BYTES).fill(0xcd);
  mem.set(H, HEAP);

  const xs = 0xaaaa_bbbb_cccc_ddddn;
  const env = mkEnvWithPayer(xs, 50n, { root: xs });

  const explicit = 5;
  const blob = makeBlob(mkCode(HEAP, 9, 77, 88, 0, explicit));
  const st   = runBlob(blob, GAS, { env, memInit: mem });

  expect(st.registers[7]).toBe(BigInt(explicit));
  expect(env.getService(BigInt(explicit))).toBeTruthy();
  expect(env.getService(xs)!.balance).toBe(50n - ACTIVATION_FEE);
});

it("explicit id by root (i < S) -> returns i and uses it", () => {
  const mem = new Uint8Array(1<<20);
  const H = new Uint8Array(HASH_BYTES).fill(0xcd);
  mem.set(H, HEAP);

  const xs = 0xaaaa_bbbb_cccc_ddddn;
  const env = mkEnvWithPayer(xs, 50n, { root: xs });

  const explicit = 5;
  const blob = makeBlob(mkCode(HEAP, 9, 77, 88, 0, explicit));
  const st   = runBlob(blob, GAS, { env, memInit: mem });

  expect(st.registers[7]).toBe(BigInt(explicit));
  expect(env.getService(BigInt(explicit))).toBeTruthy();
  expect(env.getService(xs)!.balance).toBe(50n - ACTIVATION_FEE);
});

it("explicit id already staged -> FULL", () => {
  const mem = new Uint8Array(1<<20);
  const H = new Uint8Array(HASH_BYTES).fill(0xef);
  mem.set(H, HEAP);

  const xs = 0x1234_1234_1234_1234n;
  const env = mkEnvWithPayer(xs, 50n, { root: xs });

  const explicit = 7;
  env.acc.allocator.env.updates.set(BigInt(explicit), { mock: true });

  const blob = makeBlob(mkCode(HEAP, 3, 1, 1, 0, explicit));
  const st   = runBlob(blob, GAS, { env, memInit: mem });

  expect(st.registers[7]).toBe(FULL);
});

it("invalid codehash ptr -> Panic", () => {
  const xs = 0x1111_0000_9999_0000n;
  const env = mkEnvWithPayer(xs, 100n);

  const blob = makeBlob(mkCode(HEAP, 5, 6, 7, 0, 0));
  const st   = runBlob(blob, GAS, { env, memInit: new Uint8Array(1<<20) });

  expect(st.exit?.type).toBe(ExitReasonType.Panic);
});

it("label out-of-range -> Panic", () => {
  const mem = new Uint8Array(1<<20);
  const H = new Uint8Array(HASH_BYTES).fill(0x77);
  mem.set(H, HEAP);

  const xs = 0x8888_7777_6666_5555n;
  const env = mkEnvWithPayer(xs, 100n);

  const blob = makeBlob(mkCode(HEAP, 0x1_0000_0000, 10, 20, 0, 0));
  const st   = runBlob(blob, GAS, { env, memInit: mem });

  expect(st.exit?.type).toBe(ExitReasonType.Panic);
});

it("stores rootCodeHash and gas limits on the new account", () => {
  const mem = new Uint8Array(1<<20);
  const H = new Uint8Array(32).fill(0x11);
  mem.set(H, HEAP);

  const xs = 0x0f0f_f0f0_0f0f_f0f0n;
  const env = mkEnvWithPayer(xs, 100n);

  const GAS_ACC = 1234, GAS_TRANSFER = 5678;
  const blob = makeBlob(mkCode(HEAP, 42, GAS_ACC, GAS_TRANSFER, 0, 0));
  const st   = runBlob(blob, GAS, { env, memInit: mem });
  const id   = st.registers[7];
  const svc  = env.getService(id)!;

  const beHex = Buffer.from(H).reverse().toString("hex");
  expect(svc.rootCodeHash).toBe(BigInt("0x"+beHex));
  expect(svc.gasAccumulate).toBe(BigInt(GAS_ACC));
  expect(svc.gasOnTransfer).toBe(BigInt(GAS_TRANSFER));
});

it("(c,l) pair is recorded in lookupStorage", () => {
  const mem = new Uint8Array(1<<20);
  const H = new Uint8Array(HASH_BYTES).fill(0x42);
  mem.set(H, HEAP);

  const xs = 0x2222_3333_4444_5555n;
  const env = mkEnvWithPayer(xs, 100n);

  const l = 1234;
  const blob = makeBlob(mkCode(HEAP, l, 9, 9, 0, 0));
  const st   = runBlob(blob, GAS, { env, memInit: mem });

  const id = st.registers[7];
  const acct = env.getService(id)!;

  const key = new Uint8Array(32+4);
  key.set(H, 0);
  key[32] = l & 0xff;
  key[33] = (l>>8) & 0xff;
  key[34] = (l>>16) & 0xff;
  key[35] = (l>>24) & 0xff;
  const clKey = Buffer.from(key).toString("hex");

  expect(acct.lookupStorage.has(clKey)).toBe(true);
});

it("skips taken ids and advances allocator cursor", () => {
  const mem = new Uint8Array(1<<20);
  mem.set(CODE_HASH, HEAP);

  const xs = 0x9999_aaaa_bbbb_ccccn;
  const env = mkEnvWithPayer(xs, 100n);

  const id1 = nextIdInRing(env.acc.allocator.index);
  env.putService(id1, mkService(id1, 0n, 0n));

  const id2 = nextIdInRing(id1);
  const st  = runBlob(makeBlob(mkCode()), GAS, { env, memInit: mem });

  expect(st.registers[7]).toBe(id2);
  expect(env.acc.allocator.index).toBe(id2);
});
})