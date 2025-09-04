import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { OK, OOB, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { MachineEntry } from "../../../risc-pvm/interpreter/host/types";

const SRC        = 0x1A000;
const BAD_ADDR   = 0x0020;
const GAS        = 100;

// n is the machine id, 
// s is the source address, 
// o is the inner offset, 
// z is the size

function outerCodePoke(id: number, src: number, dest: number, len: number) {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  id & 255, id >>> 8 & 255, id >>> 16 & 255, id >>> 24 & 255,
    Opcodes.load_imm, 8,  src & 255, src >>> 8 & 255, src >>> 16 & 255, src >>> 24 & 255,
    Opcodes.load_imm, 9,  dest & 255, dest >>> 8 & 255, dest >>> 16 & 255, dest >>> 24 & 255,
    Opcodes.load_imm,10,  len & 255, len >>> 8 & 255, len >>> 16 & 255, len >>> 24 & 255,
    Opcodes.ecalli, 10, // ΩO  – poke
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
function makeMachine(memContents: Uint8Array): MachineEntry {
  return { p: new Uint8Array(), u: { v: memContents, a: [] }, i: 0 };
}

const innerMem = new Uint8Array(16).map((_,i)=>i+1); // [1..16]
const machine0: MachineEntry = { p:new Uint8Array(), u:{ v: innerMem, a: [] }, i:0 };

describe("ΩO poke handler", () => {

    it("happy‑path -> r7=OK & inner mem updated", () => {
      const innerMachine = makeMachine(innerMem)
      const env = makeHostEnv({ machines: new Map([[0, innerMachine ]])});
      const mem = new Uint8Array(1<<20);
      mem.set([9,9,9,9], SRC);

      console.log("innerMem before poke", innerMem, "mem", mem.slice(SRC, SRC+4));
  
      const blob = makeBlob(outerCodePoke(0, SRC, 4, 4)); // write at inner offset 4
      const st   = runBlob(blob, GAS, { env, memInit: mem });
  
      expect(st.registers[7]).toBe(OK);
      expect(env.machineTable.get(0)!.u.v.slice(4,8)).toEqual(Uint8Array.of(9,9,9,9));
      expect(st.exit?.type).toBe(ExitReasonType.Panic);
    });
  
    it("unknown machine -> r7 = WHO", () => {
      const env  = makeHostEnv();
      const mem  = new Uint8Array(1<<20).fill(7);
      const blob = makeBlob(outerCodePoke(55, SRC, 0, 2));
      const st   = runBlob(blob, GAS, { env, memInit: mem });
  
      expect(st.registers[7]).toBe(WHO);
    });
  
    it("outer src unmapped -> Panic", () => {
      const env = makeHostEnv({ machines: new Map([[0, machine0]]) });
      const blob = makeBlob(outerCodePoke(0, BAD_ADDR, 0, 4));
      const st   = runBlob(blob, GAS, { env, memInit:new Uint8Array(1<<20) });
  
      expect(st.exit?.type).toBe(ExitReasonType.Panic);
    });
  
    it("inner dest OOB -> r7 = OOB", () => {
      const env = makeHostEnv({ machines: new Map([[0, machine0]]) });
      const mem = new Uint8Array(1<<20);
      mem.set([1,1,1], SRC);
  
      const blob = makeBlob(outerCodePoke(0, SRC, 20, 3)); // 20+3 > 16 -> OOB
      const st   = runBlob(blob, GAS, { env, memInit: mem });
  
      expect(st.registers[7]).toBe(OOB);
    });
  });