import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { NONE, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { hash } from "../../../utils/crypto";

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
  it("happy‑path copies value & sets r7=vLength", () => {
    const code = makeCode();
    let  updatedCode = Uint8Array.from(code);
    updatedCode = Uint8Array.of(
        Opcodes.load_imm_64, 7, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,// r7 = NONE
      ...updatedCode
    );
    const bitmask = Uint8Array.of(0b0000_0001, 0b0000_0100, 0b0100_0001, 0b0001_0000, 0b0000_0100, 0b0000_0101);

    const blob = makeBlob(updatedCode, bitmask);
   
    const servicePrefix = toLE(0xffff_ffffn, 4);
    const fooKey = Uint8Array.of(0x66, 0x6f, 0x6f);  
    const prefixed = new Uint8Array(servicePrefix.length + fooKey.length);
    const mem = new Uint8Array(1 << 20); 
    prefixed.set(servicePrefix);
    prefixed.set(fooKey, servicePrefix.length);
    const digestFoo = hash(prefixed);  
    mem.set(fooKey, KEY_ADDR);  // key "foo" at KEY_ADDR    
    const VALUE = Uint8Array.from([1,2,3,4,5,6]);

    const store  = new Map<string, Uint8Array>().set(Array.from(digestFoo).join(","), VALUE);
    const env   = makeHostEnv({ now: 0n, storage: store });  // vectors={}, now=0, storage=store
    const st = runBlob(blob, 100, { env, memInit: mem });

    console.log("Registers after run:", st.registers);
    expect(st.registers[7]).toBe(BigInt(VALUE.length));  // vLength
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

  it("key bytes unmapped -> r7 = NONE", () => {
    const mem = new Uint8Array(1 << 20); // 1Mib memory
    const env = makeHostEnv();
    const code  = makeCode();

    
    let  updatedCode = Uint8Array.from(code);
    updatedCode = Uint8Array.of(
        Opcodes.load_imm_64, 7, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,// r7 = NONE
        Opcodes.load_imm, BAD_ADDR & 0xff, (BAD_ADDR >> 8) & 0xff, (BAD_ADDR >> 16) & 0xff, (BAD_ADDR >> 24) & 0xff,
      ...updatedCode.slice(5) 
    // ...updatedCode
    );

    console.log("updatedCode", updatedCode);

    const bitmask = Uint8Array.of(0b0000_0001, 0b1000_0010, 0b0010_0000, 0b0000_1000, 0b1000_0010, 0b0000_0010);

    const blob  = makeBlob(updatedCode, bitmask);
    const st  = runBlob(blob, 100, { env, memInit: mem });
    console.log("Registers after run:", st.registers);
  
    expect(st.registers[7]).toBe(NONE);
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

  
  it("dest in R/O page -> r7 = NONE", () => {
    // 1.  Build a variant of the program whose copy‑destination (r10)
    // is inside the code segment
    const code = makeCode();
    let  updatedCode = Uint8Array.from(code);
    updatedCode = Uint8Array.of(
      Opcodes.load_imm_64, 7, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,// r7 = NONE
      Opcodes.load_imm, BAD_ADDR & 0xff, (BAD_ADDR >> 8) & 0xff, (BAD_ADDR >> 16) & 0xff, (BAD_ADDR >> 24) & 0xff,
      ...updatedCode.slice(5) 
    // ...updatedCode
    );
  
    const bitmask = Uint8Array.of(0b0000_0001, 0b1000_0010, 0b0010_0000, 0b0000_1000, 0b1000_0010, 0b0000_0010);
  
    const blob = makeBlob(updatedCode, bitmask);
  
    //  Memory contains the key "foo"
    const mem = new Uint8Array(1 << 20); // 1Mib memory
    mem.set([0x66, 0x6f, 0x6f], KEY_ADDR);
  
    // storage has the value, so we hit the write step
    const VAL  = Uint8Array.from([7,7,7]);
    const store = new Map<string, Uint8Array>().set("102,111,111", VAL); // "foo" key in storage
    const env   = makeHostEnv({ now: 0n, storage: store }); // vectors={}, now=0, storage=store
  
    const st = runBlob(blob, 100, { env, memInit: mem });
  
    expect(st.registers[7]).toBe(NONE); // dest not writable
    expect(st.exit?.type).toBe(ExitReasonType.Panic);  // trap executes last
  });

//   it("store full -> r7 = FULL", () => {
//     const mem = new Uint8Array(1<<20);
//     mem.set([0x66,0x6f,0x6f], KEY_ADDR);
  
//     const big  = new Uint8Array(1024).fill(1);
//     const store = new Map<string, Uint8Array>().set("102,111,111", big);
//     const env   = makeHostEnv({}, 0n, store, /*we capBytes*/ 512);

//     const code = makeCode();
//     let updatedCode = Uint8Array.from(code);
//     updatedCode = Uint8Array.of(
//         Opcodes.load_imm_64, 7, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // r7 = NONE
//         ...updatedCode
//     );
//     const bitmask = Uint8Array.of(0b0000_0001, 0b1000_0010, 0b0010_0000, 0b0000_1000, 0b1000_0010, 0b0000_0010);
//     const blob = makeBlob(updatedCode, bitmask);
  
//     const st = runBlob(blob, 100, { env, memInit: mem });
  
//     expect(st.registers[7]).toBe(FULL);
//     expect(st.exit?.type).toBe(ExitReasonType.Panic);
//   });
  
  
});