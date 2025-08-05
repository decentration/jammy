import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const GAS_START = 100;
const GAS_COST  = 10;  // ecalli base cost

// tiny program: ecalli 8 ; trap
const code = Uint8Array.of(Opcodes.ecalli, 8, Opcodes.trap);
const mask = Uint8Array.of(0b0000_0101);        // ecalli + trap
const blob = buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
                         instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask });

describe("ΩC checkpoint handler", () => {
  it("returns remaining gas in r7", () => {
    const env = makeHostEnv();
    const st  = runBlob(blob, GAS_START, { env, memInit:new Uint8Array(1<<20) });

    expect(Number(st.registers[7])).toBe(GAS_START - GAS_COST);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
