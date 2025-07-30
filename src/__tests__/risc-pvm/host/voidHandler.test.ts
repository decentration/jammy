import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { OK, WHO, HUH, OOB } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";

const GAS = 100;

/* inner machine with 32 bytes = 1..32 */
const innerMem = new Uint8Array(32).map((_, i) => i + 1);
const machine0 = { p: new Uint8Array(), u: { mem: innerMem }, i: 0 };

function code(n: number, p: number, c: number) {
  return Uint8Array.of(
		Opcodes.load_imm, 7, n,0,0,0,
		Opcodes.load_imm, 8, p,0,0,0,
		Opcodes.load_imm, 9, c,0,0,0,
		Opcodes.ecalli, 24,
		Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000, 0b0001_0100);
const blob = (b: Uint8Array) =>
  buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
		instr:b, jumpEntries:[Uint8Array.of(0)],
		bitmaskBits: bitmask 
	});


describe("ΩV void handler", () => {
  it("happy‑path -> bytes voided & OK", () => {
    const env = makeHostEnv({ machines: new Map([[0, machine0]]) });
    const st  = runBlob(blob(code(0,24,4)), GAS, { env, memInit:new Uint8Array(1<<20) });

    expect(st.registers[7]).toBe(OK);
    expect(env.machineTable.get(0)!.u.mem.slice(24,28)).toEqual(new Uint8Array(4).fill(0));
  });

  it("unknown machine -> WHO", () => {
    const env = makeHostEnv();
    const st  = runBlob(blob(code(7,20,2)), GAS, { env, memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(WHO);
  });

  it("pointer < 16 -> HUH", () => {
    const env = makeHostEnv({ machines: new Map([[0, machine0]]) });
    const st  = runBlob(blob(code(0,4,4)), GAS, { env, memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(HUH);
  });

  it("range past end -> OOB", () => {
    const env = makeHostEnv({ machines: new Map([[0, machine0]]) });
    const st  = runBlob(blob(code(0,28,8)), GAS, { env, memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(OOB);
  });
});
