import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { HUH } from "../../../risc-pvm/interpreter/host/consts";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { InnerMachineState, MachineEntry } from "../../../risc-pvm/interpreter/host/innerMem/types";

const HEAP    = 0x18000;   // inner‑VM blob lives here
const BAD_PTR = 0x0020;    // unmapped (low) address
const INITIAL_GAS = 100n; 

// inner blob trap  
const innerInstr   = Uint8Array.of(
  0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
  Opcodes.trap
);

const innerBitmask = Uint8Array.of(0b0000_0000, 0b0000_0001); // 2 bytes

const innerBlob = buildBlob({
  meta:        Uint8Array.of(0),
  jumpTbl:     Uint8Array.of(0),
  z:           1,
  instr:       innerInstr,
  jumpEntries: [Uint8Array.of(0)],
  bitmaskBits: innerBitmask,
});

const P_LEN = innerBlob.length;

const innerMem = new Uint8Array(16).map((_,i)=>i+1); // [1..16]

const inner: InnerMachineState = { vPages: new Map([[0, innerMem]]), aPages: new Map()}
const machineOpts: MachineEntry = { p: innerBlob, u: inner, i: 0 }; // Replace with a valid InnerMachineState

//  outer programme builder
function makeCode(ptr: number, len: number, idx: number): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  ptr&255, ptr>>8&255, ptr>>16&255, ptr>>24&255, // po
    Opcodes.load_imm, 8,  len&255, len>>8&255, len>>16&255, len>>24&255, // pz
    Opcodes.load_imm, 9,  idx&255, idx>>8&255, idx>>16&255, idx>>24&255, // i
    Opcodes.ecalli, 8,                                                  // ΩM
    Opcodes.trap
  );
}

const outerMask = Uint8Array.of(0b0100_0001,0b0001_0000,0b0001_0100);

const makeBlob = (code: Uint8Array) =>
  buildBlob({
    meta:       Uint8Array.of(0),
    jumpTbl:    Uint8Array.of(0),
    z:          1,
    instr:      code,
    jumpEntries:[Uint8Array.of(0)],
    bitmaskBits: outerMask,
  });

  
describe("ΩM machine handler", () => {

  it("happy‑path -> id 0, machine stored", () => {
    const mem = new Uint8Array(1<<20);
    mem.set(innerBlob, HEAP);

    const env = makeHostEnv();
    const blob = makeBlob(makeCode(HEAP, P_LEN, 0));
    const opts = { env, memInit: mem };
    const st  = runBlob(blob, INITIAL_GAS, opts);

    expect(st.registers[7]).toBe(0n);
    expect(env.machineTable?.get(0)?.p).toEqual(innerBlob);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("invalid blob -> r7 = HUH", () => {
    const mem = new Uint8Array(1<<20);
    const junk = new Uint8Array(P_LEN).fill(0x99); // junk
    mem.set(junk);

    const env = makeHostEnv();
    const blob = makeBlob(makeCode(HEAP, P_LEN, 0));
    const opts = { env, memInit: mem };
    const st  = runBlob(blob, INITIAL_GAS, opts);

    expect(st.registers[7]).toBe(HUH);
    expect(env.machineTable?.size).toBe(0);
  });

  it("unmapped pointer -> Panic, r7 unchanged", () => {
    const env = makeHostEnv();
    const blob = makeBlob(makeCode(BAD_PTR, P_LEN, 0));
    const mem = new Uint8Array(1<<20); // no inner blob
    const opts = { env, memInit: mem };
    const st  = runBlob( blob, INITIAL_GAS, opts);

    expect(st.registers[7]).toBe(BigInt(BAD_PTR));
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(env.machineTable?.size).toBe(0);
  });

  it("insertion with smae id throws HUH", () => {
    const mem = new Uint8Array(1<<20);
    mem.set(innerBlob, HEAP);

    const env = makeHostEnv(); // empty machine table
    env.machineTable?.set(0, machineOpts);

    const blob = makeBlob(makeCode(HEAP, P_LEN, 0));
    const opts = { env, memInit: mem };
    const st = runBlob(blob, INITIAL_GAS, opts);

    expect(st.registers[7]).toBe(1n);
    expect(env.machineTable?.has(1)).toBe(true);
  });

  it("second insertion picks next free id", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(innerBlob, HEAP);   // already‑registered blob (id 0)

    const env = makeHostEnv();
    env.machineTable!.set(0, machineOpts); // id 0 taken

    // use a different i so the (p,i) pair is new
    const blob = makeBlob(makeCode(HEAP, P_LEN, 123)); // id 123 does not equal 0
    const opts = { env, memInit: mem };
    const st = runBlob( blob, INITIAL_GAS, opts);

    expect(st.registers[7]).toBe(1n);      // id 1 assigned
    expect(env.machineTable!.has(1)).toBe(true);
  });
});
