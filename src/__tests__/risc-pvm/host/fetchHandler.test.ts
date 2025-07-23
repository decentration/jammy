import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { NONE, WHAT } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

// Helper that builds a tiny program:  r10<-sel ; ecalli 18 ; trap
const HEAP_START = 0x10000;  
function makeCode(sel: number, dest= HEAP_START): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,
    dest & 0xFF,
    (dest >> 8)  & 0xFF,
    (dest >> 16) & 0xFF,
    (dest >> 24) & 0xFF,
   Opcodes.load_imm, 10, sel, 0,0,0, // ω10 = selector
    Opcodes.ecalli,   18,
    Opcodes.trap
  );
}
// b
const makeBlob = (code: Uint8Array, bitmask: Uint8Array) => {
    return buildBlob({
    meta: Uint8Array.of(0),
    jumpTbl: Uint8Array.of(0),
    z: 1,
    instr: code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
};

const bitmask = Uint8Array.of(0b0100_0001, 0b0101_0000);   // imm, ecalli, trap

describe("ΩY fetch handler", () => {

  it("happy‑path: copies bytes & sets r7=size", () => {
    const V = Uint8Array.from([1,2,3,4,5]);
    const env   = makeHostEnv({ codeBlob: V });
    const code = makeCode(0); 

    const blob  = makeBlob(code, bitmask);
    const st = runBlob(blob, 100, { env }, );

    expect(st.registers[7]).toBe(BigInt(V.length));  // Sv
    expect(st.memory.slice(HEAP_START, HEAP_START + V.length)).toEqual(V);   
    expect(st.exit?.type).toBe(ExitReasonType.Panic); 
  });

  it("vector missing -> r7=NONE", () => {
    const env   = makeHostEnv();  // empty
    const blob  = makeBlob(makeCode(0), bitmask);
    const st = runBlob(blob, 50, {env});

    console.log("st", st);
    expect(st.registers[7]).toBe(NONE);
  });

  it("unknown selector → r7=WHAT", () => {
    const env  = makeHostEnv();
    const blob = makeBlob(makeCode(99), bitmask); // 99 is not a valid selector
    const st = runBlob(blob, 50, {env});

    expect(st.registers[7]).toBe(WHAT);
  });

  it("write into read‑only page -> Panic", () => {
    const vec  = Uint8Array.of(9, 9, 9);
    const env  = makeHostEnv({ codeBlob: vec });
    const UNMAPPED = 0x20000;
    const blob = makeBlob(makeCode( 0, UNMAPPED), bitmask);
    const st   = runBlob(blob, 100, { env });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.gas).toBe(100 - 10 -1 -1 -1 );   
  });

});
