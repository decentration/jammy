import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { NONE, OOB, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const KEY_ADDR = 0x18000;  
const DST_ADDR = 0x19000;
const BAD_ADDR = 0x20000;  // address outside the memory range

function makeCode() {
  return Uint8Array.of(
    Opcodes.load_imm, 8,  KEY_ADDR & 0xff, KEY_ADDR>>8 & 0xff, (KEY_ADDR>>16) & 0xff,(KEY_ADDR>>24) & 0xff, // r8  (ko) 
    Opcodes.load_imm, 9,  3, 0,0,0,  // r9  (kz)  // "foo"
    Opcodes.load_imm, 10, DST_ADDR & 0xff, DST_ADDR>>8 & 0xff, (DST_ADDR>>16) & 0xff,(DST_ADDR>>24) & 0xff,  // r10 (o) 
    Opcodes.load_imm, 11, 0,0,0,0,  // r11 (f) 
    Opcodes.load_imm, 12, 0,0,0,0,   // r12 (l)   // 0 -> to end
    Opcodes.ecalli, 2, // host-call 
    Opcodes.trap
  );
}

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


const bitmask = Uint8Array.of(0b0100_0001, 0b0001_0000, 0b0000_0100, 0b0100_0001, 0b0000_0001); // 0x41, 0x10, 0x08, 0x00); 

describe("ΩR read handler", () => {
  it("happy‑path copies value & sets r7=Sv", () => {
    const code = makeCode();
    let  updatedCode = Uint8Array.from(code);
    updatedCode = Uint8Array.of(
      Opcodes.load_imm, 7, 0xff, 0xff, 0xff, 0xff, // r7 = NONE
      ...updatedCode
    );
    const bitmask = Uint8Array.of(0b0100_0001, 0b0001_0000, 0b0000_0100, 0b0100_0001, 0b0101_0000);

    const blob = makeBlob(updatedCode, bitmask);
    const mem = new Uint8Array(1 << 20);
    mem.set([0x66, 0x6f, 0x6f], KEY_ADDR); // "foo" key 

    const VALUE = Uint8Array.from([1,2,3,4,5,6]);

    const store = new Map<string, Uint8Array>().set("102,111,111", VALUE); // "foo" key in storage
    const env = makeHostEnv({}, 0n, store);  // vectors={}, now=0, storage=store
    const st = runBlob(blob, 100, { env, memInit: mem });

    expect(st.registers[7]).toBe(BigInt(VALUE.length));  // Sv
    expect(st.memory.slice(DST_ADDR, DST_ADDR + VALUE.length)).toEqual(VALUE);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("missing key -> r7=NONE", () => {
    const code  = makeCode();

    const blob  = makeBlob(code, bitmask);
    const mem  = new Uint8Array(1 << 20);
    mem.set([0x66,0x6f,0x6f], KEY_ADDR);

    const env = makeHostEnv();  // empty storage
    const st = runBlob(blob, 100, { env, memInit: mem });
    console.log(st.registers);
    expect(st.registers[7]).toBe(WHO);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("key bytes unmapped -> r7 = OOB", () => {
    const mem = new Uint8Array(1 << 20); // 1Mib memory
    const env = makeHostEnv();
    const code  = makeCode();

    
    let  updatedCode = Uint8Array.from(code);
    updatedCode = Uint8Array.of(
      Opcodes.load_imm, 7, 0xff, 0xff, 0xff, 0xff, // r7 = NONE
      Opcodes.load_imm, BAD_ADDR & 0xff, (BAD_ADDR >> 8) & 0xff, (BAD_ADDR >> 16) & 0xff, (BAD_ADDR >> 24) & 0xff,
      ...updatedCode.slice(5) 
    // ...updatedCode
    );

    console.log("updatedCode", updatedCode);

    const bitmask = Uint8Array.of(0b0100_0001, 0b0001_0000, 0b0000_0100, 0b0100_0001, 0b0101_0000);

    const blob  = makeBlob(updatedCode, bitmask);
    const st  = runBlob(blob, 100, { env, memInit: mem });
    console.log("Registers after run:", st.registers);
  
    expect(st.registers[7]).toBe(OOB);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
  

  it("unknown service index -> r7 = WHO", () => {
    // Patch program so r7 (srvIdx) = 123                  */
    const badCode = Uint8Array.from(makeCode());
    badCode[2] = 123;  // second byte after load_imm opcode (little‑endian)
    const badBlob = makeBlob(badCode, bitmask);
  
    const mem = new Uint8Array(1 << 20);
    const env = makeHostEnv();
    const st  = runBlob(badBlob, 100, { env, memInit: mem });
  
    expect(st.registers[7]).toBe(WHO);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  
  it("dest in R/O page -> r7 = OOB", () => {
    // 1.  Build a variant of the program whose copy‑destination (r10)
    // is inside the code segment
    const code = makeCode();
    let  updatedCode = Uint8Array.from(code);
    updatedCode = Uint8Array.of(
      Opcodes.load_imm, 7, 0xff, 0xff, 0xff, 0xff, // r7 = NONE
      Opcodes.load_imm, BAD_ADDR & 0xff, (BAD_ADDR >> 8) & 0xff, (BAD_ADDR >> 16) & 0xff, (BAD_ADDR >> 24) & 0xff,
      ...updatedCode.slice(5) 
    // ...updatedCode
    );
  
    const bitmask = Uint8Array.of(0b0100_0001, 0b0001_0000, 0b0000_0100, 0b0100_0001, 0b0101_0000);
  
    const blob = makeBlob(updatedCode, bitmask);
  
    //  Memory contains the key "foo"
    const mem = new Uint8Array(1 << 20); // 1Mib memory
    mem.set([0x66, 0x6f, 0x6f], KEY_ADDR);
  
    // storage has the value, so we hit the write step
    const VAL  = Uint8Array.from([7,7,7]);
    const store = new Map<string, Uint8Array>().set("102,111,111", VAL); // "foo" key in storage
    const env   = makeHostEnv({}, 0n, store);
  
    const st = runBlob(blob, 100, { env, memInit: mem });
  
    expect(st.registers[7]).toBe(OOB); // dest not writable
    expect(st.exit?.type).toBe(ExitReasonType.Panic);  // trap executes last
  });
});