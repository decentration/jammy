import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { WHO } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";

const GAS = 100;

function code(r7: number, r8 = 0) {
  return Uint8Array.of(
    Opcodes.load_imm, 7, r7&255, r7>>8&255, r7>>16&255, r7>>24&255,
    Opcodes.load_imm, 8, r8&255, r8>>8&255, r8>>16&255, r8>>24&255,
    Opcodes.ecalli, 26,
    Opcodes.trap
  );
}

const mask = Uint8Array.of(0b0100_0001,0b0101_0000);

const makeBlob = (c: Uint8Array) =>
  buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
  	instr:c, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask }
	);

// dummy machine entry
const dummyEntry = { p:new Uint8Array(), u:{ mem:new Uint8Array(256) }, i:42 };

describe("ΩX expunge handler", () => {

	it("happy‑path deletes entry & returns prev‑i", () => {
		const env = makeHostEnv({ machines:new Map([[0,dummyEntry]]) });
		const st  = runBlob(makeBlob(code(0)), GAS, { env, memInit:new Uint8Array(1<<20) });

		expect(st.registers[7]).toBe(42n);    // previous i
		expect(env.machineTable.has(0)).toBe(false);  // removed
	});

	it("unknown id -> WHO, table intact", () => {
		const env = makeHostEnv();
		const st  = runBlob(makeBlob(code(5)), GAS, { env, memInit:new Uint8Array(1<<20) });
		expect(st.registers[7]).toBe(WHO);
	});
});
  