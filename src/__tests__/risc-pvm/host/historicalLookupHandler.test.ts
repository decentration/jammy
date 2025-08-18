import { buildBlob }       from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv }     from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes }         from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }         from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }  from "../../../risc-pvm/interpreter/types";
import { NONE, WHO }       from "../../../risc-pvm/interpreter/host/consts";

const HASH_ADDR = 0x18000;
const DEST_ADDR  = 0x19000;
const BAD_ADDR  = 0x20000;

function makeCode (): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7, 0xff,0xff,0xff,0xff,                  // r7  srv‑idx
    Opcodes.load_imm, 8, HASH_ADDR&255, HASH_ADDR>>8&255, 
                         HASH_ADDR>>16&255, HASH_ADDR>>24&255, // r8  hash ptr
    Opcodes.load_imm, 9, DEST_ADDR&255, DEST_ADDR>>8&255, 
                         DEST_ADDR>>16&255, DEST_ADDR>>24&255, // r9  dest
    Opcodes.load_imm,10, 0,0,0,0,                              // r10 f‑off
    Opcodes.load_imm,11, 0,0,0,0,                              // r11 len (=0)
    Opcodes.ecalli, 17,                                        // ΩH
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000,0b0000_0100, 0b0100_0001,0b0000_0001);

const blob = (c: Uint8Array = makeCode()) => buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1, instr:c, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

describe("ΩH historical_lookup handler", () => {
  it("happy‑path: copies pre‑image, r7 = vLength", () => {
    const HASH  = new Uint8Array(32).fill(7);
    const VALUE = Uint8Array.from([9,8,7,6,5]);
    const mem   = new Uint8Array(1<<20);
    mem.set(HASH, HASH_ADDR);

    const imgs  = new Map<string,Uint8Array>().set(Array.from(HASH).join(","), VALUE);
    const env   = makeHostEnv({now: 0n,capBytes: Infinity,preImage: imgs});

    const st = runBlob(blob(), 100, { env, memInit: mem });

    expect(st.registers[7]).toBe(BigInt(VALUE.length));
    expect(st.memory.slice(DEST_ADDR, DEST_ADDR + VALUE.length)).toEqual(VALUE);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("missing pre‑image -> r7 = NONE", () => {
    const HASH = new Uint8Array(32).fill(1);
    const mem  = new Uint8Array(1<<20);
    mem.set(HASH, HASH_ADDR);

    const st = runBlob(blob(), 100, { env: makeHostEnv(), memInit: mem });

    expect(st.registers[7]).toBe(NONE);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("hash bytes unmapped -> Panic", () => {
    const st = runBlob(blob(), 100, { env: makeHostEnv(), memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("unknown service index -> r7 = WHO", () => {
    const bad = Uint8Array.from(makeCode());
    bad[2] = 42;
    const mem = new Uint8Array(1<<20);
    mem.set(new Uint8Array(32).fill(2), HASH_ADDR);

    const st = runBlob(blob(bad), 100, { env: makeHostEnv(), memInit: mem });

    expect(st.registers[7]).toBe(WHO);
  });

  it("dest in R/O page -> Panic", () => {
    const bad = Uint8Array.from(makeCode());
    bad[14] = BAD_ADDR&255; 
    bad[15] = BAD_ADDR>>8&255;
    bad[16] = BAD_ADDR>>16&255; 
    bad[17] = BAD_ADDR>>24&255;

    const mem = new Uint8Array(1<<20);
    mem.set(new Uint8Array(32).fill(3), HASH_ADDR);

    const st = runBlob(blob(bad), 100, { env: makeHostEnv(), memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
