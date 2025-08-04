import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { CORE, CORE_BYTES, CORES_PER_SERVICE, OK, SVC_ID } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const HEAP = 0x18000;
const GAS  = 100;

function codeAssign(idx=0,o=HEAP){
  return Uint8Array.of(
    Opcodes.load_imm,7, idx,0,0,0,
    Opcodes.load_imm,8, o&255,o>>8&255,o>>16&255,o>>24&255,
    Opcodes.ecalli,6,
    Opcodes.trap
  );
}
const mask = Uint8Array.of(0b0100_0001,0b0101_0000);

function makeBlob(code: Uint8Array): Uint8Array {
    return buildBlob({
      meta: Uint8Array.of(0), jumpTbl: Uint8Array.of(0), z:1,
      instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask
    });
  }

describe("ΩA assign handler", () => {
  it("happy‑path -> OK", () => {
    const mem = new Uint8Array(1<<20);
    mem.set(new Uint8Array(CORE_BYTES * CORES_PER_SERVICE).fill(1), HEAP);
    const env = makeHostEnv();
    const st  = runBlob(makeBlob(codeAssign()), GAS, { env, memInit: mem });

    const service = env.getService(SVC_ID)!;

    expect(st.registers[7]).toBe(OK);
    expect(service.cores.length).toBe(CORE_BYTES * CORES_PER_SERVICE);
    expect(service.cores.every(b => b === 1)).toBe(true);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);  });

  it("index >= Q -> CORE", () => {
    const env = makeHostEnv();
    const st  = runBlob(makeBlob(codeAssign(99,HEAP)), GAS, { env, memInit:new Uint8Array(1<<20) });
    expect((st.registers[7])).toBe(CORE); // 'CORE'
  });
}); 