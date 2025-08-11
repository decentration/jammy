import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { HASH_BYTES, OK, SVC_ID, WHAT, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";

const HEAP = 0x18000;
const GAS  = 100;

function mkCode(o=HEAP, g=123n, m=456n) {
    return Uint8Array.of(
      Opcodes.load_imm,   7,  o&255, o>>8&255, o>>16&255, o>>24&255,
      Opcodes.load_imm_64,8,  ...toLE(g, 8),
      Opcodes.load_imm_64,9,  ...toLE(m, 8),
      Opcodes.ecalli, 10,
      Opcodes.trap
    );
  }

const bitmask = Uint8Array.of(
  0b0100_0001, // load_imm
  0b0000_0001, // load_imm_64
  0b0000_0001, // load_imm_64
  0b0001_0100  // ecalli, trap
);

const mkBlob = (code: Uint8Array) =>
  buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
              instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

describe("ΩU upgrade handler", () => {
  it("happy-path updates rootCodeHash and gas limits, r7=OK", () => {
    const codeHash = new Uint8Array(HASH_BYTES).map((_,i)=> (i*3)&0xFF);
    const mem = new Uint8Array(1<<20);
    mem.set(codeHash, HEAP);

    const env = makeHostEnv();
    env.putService(SVC_ID, {
      storage:new Map(), preimages:new Map(), lookupStorage:new Map(),
      rootCodeHash: 0n, balance: 0n, gasAccumulate: 0n, gasOnTransfer: 0n,
      cores:new Uint8Array(0), selectorMap:new Map(),
      ticketNext:0n, coresOffset:0, ticketIndex:0,
    });

    const blob = mkBlob(mkCode(HEAP, 123n, 456n));
    const st = runBlob(blob, GAS, { env, memInit: mem });
    console.log(st);
    const svc = env.getService(SVC_ID)!;

  
    expect(st.registers[7]).toBe(OK);
    expect(svc.gasAccumulate).toBe(123n);
    expect(svc.gasOnTransfer).toBe(456n);
    expect(svc.rootCodeHash).toBe(
      BigInt("0x" + Buffer.from(codeHash).reverse().toString("hex"))
    );
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("unknown current service -> r7=WHO", () => {
    const env = makeHostEnv();
    const blob = mkBlob(mkCode());
    const st = runBlob(blob, GAS, { env, memInit: new Uint8Array(1<<20) });
    console.log(st);
    expect(st.registers[7]).toBe(WHO);
  });

  it("unmapped code-hash pointer -> Panic, no mutation", () => {
    const env = makeHostEnv();
    env.putService(SVC_ID, {
      storage:new Map(), preimages:new Map(), lookupStorage:new Map(),
      rootCodeHash: 0n, balance: 0n, gasAccumulate: 1n, gasOnTransfer: 2n,
      cores:new Uint8Array(0), selectorMap:new Map(),
      ticketNext:0n, coresOffset:0, ticketIndex:0,
    });

    const BAD = 0x000020; // unmapped low page
    const blob = mkBlob(mkCode(BAD, 999n, 111n));
    const st = runBlob(blob, GAS, { env, memInit: new Uint8Array(1<<20) });

    const svc = env.getService(SVC_ID)!;
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(svc.gasAccumulate).toBe(1n);
    expect(svc.gasOnTransfer).toBe(2n);
    expect(svc.rootCodeHash).toBe(0n);
  });
});
