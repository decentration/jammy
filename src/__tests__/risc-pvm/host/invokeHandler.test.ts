import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { OK, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const HEAP = 0x18000; // where we place the 112‑byte blob
const GAS  = 100;

function code(r7: number, r8 = 0) {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  r7&255, r7>>8&255, r7>>16&255, r7>>24&255,
    Opcodes.load_imm, 8,  r8&255, r8>>8&255, r8>>16&255, r8>>24&255,
    Opcodes.ecalli, 25,
    Opcodes.trap
  );
}

const mask = Uint8Array.of(0b0100_0001,0b0101_0000);

const makeBlob = (c: Uint8Array) =>
  buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
              instr:c, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask });

// dummy machine entry
const dummyEntry = { p:new Uint8Array(), u:{ mem:new Uint8Array(256) }, i:42 };

describe("ΩK invoke handler", () => {

  it("happy‑path -> r7=OK", () => {
    const mem = new Uint8Array(1<<20);
    mem.set(new Uint8Array(112).fill(9), HEAP);

    const env = makeHostEnv({ machines:new Map([[0,dummyEntry]]) });
    const st  = runBlob(makeBlob(code(0,HEAP)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OK);
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
});

