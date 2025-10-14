import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { FAULT, HALT, HOST, OK, OOG, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { readU64LE } from "../../../risc-pvm/interpreter/host/helpers";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const HEAP = 0x18000; // where we place the 112‑byte blob
const GAS  = 100n;

function code(r7: number, r8 = 0) {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  r7&255, r7>>8&255, r7>>16&255, r7>>24&255,
    Opcodes.load_imm, 8,  r8&255, r8>>8&255, r8>>16&255, r8>>24&255,
    Opcodes.ecalli, 12,
    Opcodes.trap
  );
}

const mask = Uint8Array.of(0b0100_0001,0b0101_0000);

const makeBlob = (c: Uint8Array) =>
  buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
              instr:c, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask });

// dummy machine entry
const dummyEntry = { p:new Uint8Array(), u:{ mem:new Uint8Array(256) }, i:42 };

function mkEnv(inner?: {
  exit: ExitReasonType;
  nextIc?: number;
  gasRemaining?: bigint;
  regs?: BigUint64Array;
  mem?: any;
  hostId?: bigint;
  faultPage?: bigint;
}) {
  const runInnerMachine = inner
    ? (_p: Uint8Array, ic: number, gas: bigint, regs: BigUint64Array, mem: any) => ({
        exit: inner.exit,
        nextIc: inner.nextIc ?? ic, // 
        gasRemaining: inner.gasRemaining ?? gas,
        regs: inner.regs ?? regs,
        u: inner.mem ?? mem,
        hostId: inner.hostId,
        faultPage: inner.faultPage,
      })
    : undefined;

  const env = makeHostEnv({ // outer env
    machines: new Map([[0, dummyEntry]]),
    runInnerMachine
  });

  return env;
}


describe("ΩK invoke handler", () => {

  it("happy‑path -> r7=OK", () => {
    const mem = new Uint8Array(1<<20);
    mem.set(new Uint8Array(112).fill(9), HEAP);

    const env = mkEnv();
    const st  = runBlob(makeBlob(code(0,HEAP)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(HALT);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("unknown machine id -> WHO", () => {
    const env = makeHostEnv();
    const st  = runBlob(makeBlob(code(9,HEAP)), GAS, { env, memInit:new Uint8Array(1<<20) });
    
    expect(st.registers[7]).toBe(WHO);
  });

  it("unmapped call‑blob -> Panic", () => {
    const env = makeHostEnv({ machines:new Map([[0,dummyEntry]]) });
    const st  = runBlob(makeBlob(code(0,HEAP)), GAS, { env, memInit:new Uint8Array(1<<20) });
    
    expect(st.registers[7]).toBe(0n);   // unchanged
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });


  it("inner HostCall maps to r7=HOST, r8=hostId and advances inner ic by +1", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(new Uint8Array(112).fill(7), HEAP);

    const hostId = 99n;
    const env = mkEnv({ exit: ExitReasonType.HostCall, hostId, nextIc: 123 });
    const st  = runBlob(makeBlob(code(0, HEAP)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(HOST);
    expect(st.registers[8]).toBe(hostId);
    expect(env.machineTable.get(0)?.i).toBe(124); // +1 on host-call
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("inner PageFault maps to r7=FAULT, r8=faultPage; ic not incremented", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(new Uint8Array(112).fill(7), HEAP);

    const faultPage = 0x1234n; // 
    const env = mkEnv({ exit: ExitReasonType.PageFault, faultPage, nextIc: 321 });
    const st  = runBlob(makeBlob(code(0, HEAP)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(FAULT);
    expect(st.registers[8]).toBe(faultPage);
    expect(env.machineTable.get(0)?.i).toBe(321); // didnt change
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("inner OutOfGas maps to r7=OOG", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(new Uint8Array(112).fill(7), HEAP);

    const env = mkEnv({ exit: ExitReasonType.OutOfGas });
    const st  = runBlob(makeBlob(code(0, HEAP)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OOG);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("write-back stores gasRemaining + regsOut into the 112-byte blob", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(new Uint8Array(112).fill(0xaa), HEAP);

    const regsOut = new BigUint64Array(13);
    for (let i = 0; i < 13; i++) regsOut[i] = BigInt(i + 1);
    const gasRemaining = 777n;

    const env = mkEnv({
      exit: ExitReasonType.Halt,
      gasRemaining,
      regs: regsOut,
    });
    const st  = runBlob(makeBlob(code(0, HEAP)), GAS, { env, memInit: mem });

    const blob = st.memory.slice(HEAP, HEAP + 112);

    const g0 = readU64LE(blob, 0)
    const r0 = readU64LE(blob,  8)

    expect(g0).toBe(gasRemaining); // gasRemaining as (LE) 
    expect(r0).toBe(1n);    // regsOut[0] as (LE)
    expect(st.registers[7]).toBe(HALT);
  });
});