import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { CASH } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const HEAP = 0x18000;
const GAS  = 100;
const SENDER = 0xffff_ffff_ffff_ffffn;
const CODE_HASH = new Uint8Array(32).fill(0xAA);


function codeNew(ptr=HEAP, label=42, gasA=111, gasT=222) {
  return Uint8Array.of(
    Opcodes.load_imm, 7, ptr&255, ptr>>8&255, ptr>>16&255, ptr>>24&255,  // o
    Opcodes.load_imm, 8, label&255, label>>8&255, label>>16&255, label>>24&255, // l
    Opcodes.load_imm, 9, gasA&255, gasA>>8&255, gasA>>16&255, gasA>>24&255, // g
    Opcodes.load_imm,10, gasT&255, gasT>>8&255, gasT>>16&255, gasT>>24&255, // m
    Opcodes.ecalli, 9,                                                    // ΩN new
    Opcodes.trap
  );
}
const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000, 0b0000_0100, 0b0000_0101);


function makeBlob(code: Uint8Array): Uint8Array {
  return buildBlob({
    meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
    instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask
  });
}

describe("ΩN new handler", () => {
  it("happy-path: creates new account, r7 = id, debits sender", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(CODE_HASH, HEAP); // 32-byte hash at HEAP
    // set sender with > fee
    const env = makeHostEnv();
    env.putService(SENDER, {
        storage:new Map(), preimages:new Map(), lookupStorage:new Map(),
        rootCodeHash:0n, balance: 40n, gasAccumulate:0n, gasOnTransfer:0n,
        cores:new Uint8Array(0), selectorMap:new Map()
    })
      

    const st = runBlob(makeBlob(codeNew()), GAS, { env, memInit: mem });
    expect((st.registers[7])).toBe(0n); // first id assigned
    expect(env.getService(0n)).toBeTruthy();
    expect(env.getService(SENDER)!.balance).toBe(30n); // 40 - 10
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("insufficient balance -> CASH", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(CODE_HASH, HEAP);
    const env = makeHostEnv();
    env.putService(SENDER, {
        storage:new Map(), preimages:new Map(), lookupStorage:new Map(),
        rootCodeHash:0n, balance: 5n, gasAccumulate:0n, gasOnTransfer:0n,
        cores:new Uint8Array(0), selectorMap:new Map()
    })

    const st = runBlob(makeBlob(codeNew()), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(CASH);
    expect(env.getService(0n)).toBeFalsy();
  });

  it("invalid codehash ptr -> Panic", () => {
    const env = makeHostEnv();
    env.putService(SENDER, {
      storage: new Map(), preimages: new Map(), lookupStorage: new Map(),
      rootCodeHash: 0n, balance: 100n, gasAccumulate: 0n, gasOnTransfer: 0n,
      cores: new Uint8Array(0), selectorMap: new Map()
    });

    // nothing mapped at HEAP
    const st = runBlob(makeBlob(codeNew()), GAS, { env, memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("label out-of-range -> Panic", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(new Uint8Array(32).fill(0xcc), HEAP);
    const env = makeHostEnv();
    env.putService(SENDER, {
      storage: new Map(), preimages: new Map(), lookupStorage: new Map(),
      rootCodeHash: 0n, balance: 100n, gasAccumulate: 0n, gasOnTransfer: 0n,
      cores: new Uint8Array(0), selectorMap: new Map()
    });

    // label > 2^32-1
    const st = runBlob(makeBlob(codeNew(HEAP, 0x1_0000_0000)), GAS, { env, memInit: mem });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
