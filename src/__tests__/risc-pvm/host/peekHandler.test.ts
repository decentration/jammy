import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { OK, OOB, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { MachineEntry } from "../../../risc-pvm/interpreter/host/types";

const DEST       = 0x19000;
const BAD_ADDR   = 0x0020;
const GAS        = 100;

function outerCodePeek(n: number, o: number, s: number, z: number) {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  n&255, n>>8&255, n>>16&255, n>>24&255,
    Opcodes.load_imm, 8,  o&255, o>>8&255, o>>16&255, o>>24&255,
    Opcodes.load_imm, 9,  s&255, s>>8&255, s>>16&255, s>>24&255,
    Opcodes.load_imm,10,  z&255, z>>8&255, z>>16&255, z>>24&255,
    Opcodes.ecalli, 9,   // ΩP
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000, 0b0000_0100, 0b0000_0101);

const makeBlob = (code: Uint8Array) =>
  buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
    instr:code, jumpEntries:[Uint8Array.of(0)],
    bitmaskBits: bitmask }
  );

// inner machine
const innerMem = new Uint8Array(16).map((_,i)=>i+1); // [1..16]
const machine0: MachineEntry = { p:new Uint8Array(), u:{ v: innerMem , a: []}, i:0 };


describe("ΩP peek handler", () => {

  it("happy‑path -> r7=OK & bytes copied", () => {
    const env = makeHostEnv({ machines: new Map([[0, machine0]]) });
    const code = outerCodePeek(0, DEST, 2, 4); // copy [3,4,5,6]
    const blob = makeBlob(code);

    const mem = new Uint8Array(1<<20);
    const st  = runBlob(blob, GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OK);
    expect(st.memory.slice(DEST, DEST+4)).toEqual(Uint8Array.of(3,4,5,6));
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("unknown machine -> r7 = WHO", () => {
    const env  = makeHostEnv();
    const blob = makeBlob(outerCodePeek(123, DEST, 0, 1));
    const st   = runBlob(blob, GAS, { env, memInit: new Uint8Array(1<<20) });

    expect(st.registers[7]).toBe(WHO);
  });

  it("inner OOB -> r7 = OOB", () => {
    const env  = makeHostEnv({ machines: new Map([[0, machine0]]) });
    const blob = makeBlob(outerCodePeek(0, DEST, 14, 4));   // 14+4 > 16
    const st   = runBlob(blob, GAS, { env, memInit:new Uint8Array(1<<20) });

    expect(st.registers[7]).toBe(OOB);
  });

  it("outer dest unmapped -> Panic", () => {
    const env  = makeHostEnv({ machines: new Map([[0, machine0]]) });
    const blob = makeBlob(outerCodePeek(0, BAD_ADDR, 0, 4));
    const st   = runBlob(blob, GAS, { env, memInit:new Uint8Array(1<<20) });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});