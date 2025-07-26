import { buildBlob }       from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv }     from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes }         from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }         from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }  from "../../../risc-pvm/interpreter/types";
import { NONE, FULL } from "../../../risc-pvm/interpreter/host/consts";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { hash } from "../../../utils/crypto";

const KEY_ADDR = 0x18000;
const VAL_ADDR = 0x19000;
const BAD_ADDR = 0x20000; // address outside the memory range

function makeCode(vLen: number): Uint8Array {
  return Uint8Array.of(
    /* r7  service‑idx */ Opcodes.load_imm, 7,  0xff,0xff,0xff,0xff,
    /* key bytes "foo" */ Opcodes.load_imm, 8,  KEY_ADDR&255, KEY_ADDR>>8&255, KEY_ADDR>>16&255, KEY_ADDR>>24&255,
                          Opcodes.load_imm, 9,  3,0,0,0,
    /* value ptr/len   */ Opcodes.load_imm,10,  VAL_ADDR&255, VAL_ADDR>>8&255, VAL_ADDR>>16&255, VAL_ADDR>>24&255,
                          Opcodes.load_imm,11,  vLen&255, vLen>>8&255, vLen>>16&255, vLen>>24&255,
    Opcodes.ecalli, 3,     // ΩW
    Opcodes.trap
  );
}

const code = makeCode(6);
const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000,0b0000_0100,0b0100_0001,0b0000_0001);
const blob = buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1, instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

const fooKey = Uint8Array.from([0x66, 0x6f, 0x6f]);
const prefix = toLE(0xffff_ffffn, 4);
const prefixed = new Uint8Array(prefix.length + fooKey.length);
prefixed.set(prefix); prefixed.set(fooKey, prefix.length);
const digestFoo = hash(prefixed);


const store = new Map<string, Uint8Array>();
const env = makeHostEnv({}, 0n, store);

describe("ΩW write handler", () => {
  it("insert new key -> r7=NONE, value stored", () => {
    const mem = new Uint8Array(1<<20);
    mem.set([0x66,0x6f,0x6f], KEY_ADDR);  // key "foo"
    mem.set([1,2,3,4,5,6], VAL_ADDR);

    const store = new Map<string, Uint8Array>();
    const env   = makeHostEnv({}, 0n, store);

    const st = runBlob(blob, 100, { env, memInit: mem });

    expect(st.registers[7]).toBe(NONE);
    expect(env.getStorage!(digestFoo)).toEqual(Uint8Array.from([1,2,3,4,5,6]));

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("dest key unmapped -> r7=Panic", () => {
    const mem = new Uint8Array(1<<20);           // no key bytes loaded

    const badCode = (() => {
    const c = makeCode(6);
    // patch bytes  8..11 (load_imm r8 immediate) to BAD_ADDR little‑endian
    c[8]  = BAD_ADDR & 0xff;
    c[9]  = BAD_ADDR >>> 8 & 0xff;
    c[10] = BAD_ADDR >>> 16 & 0xff;
    c[11] = BAD_ADDR >>> 24 & 0xff;
    return c;
    })();

    const bitmask = Uint8Array.of(0b0100_0001, 0b0001_0000, 0b0000_0100, 0b0100_0001, 0b0000_0001);
    const badBlob = buildBlob({
        meta: Uint8Array.of(0),
        jumpTbl: Uint8Array.of(0),
        z: 1,
        instr: badCode,
        jumpEntries: [Uint8Array.of(0)],
    
        bitmaskBits: bitmask
    });
    const st   = runBlob(badBlob, 100, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);  });

  it("store FULL -> r7=FULL, value not written", () => {
    const mem = new Uint8Array(1<<20);
    mem.set([0x66,0x6f,0x6f], KEY_ADDR);
    mem.set([1,2,3,4,5,6], VAL_ADDR);

    const store = new Map<string, Uint8Array>();
    const env   = makeHostEnv({}, 0n, store, /*capBytes*/ 4); // 4 < 6 triggers FULL
    const st    = runBlob(blob, 100, { env, memInit: mem });

    expect(st.registers[7]).toBe(FULL);
    expect(env.getStorage!(Uint8Array.from([0x66,0x6f,0x6f]))).toBeUndefined();
  });


  it("store FULL -> r7 = FULL (ΩW)", () => {
    const mem = new Uint8Array(1<<20);
    mem.set([0x66,0x6f,0x6f], KEY_ADDR);  // key "foo"
    mem.set(new Uint8Array(1024).fill(1), VAL_ADDR); // value 1024 bytes
  

    const store = new Map<string, Uint8Array>();
    const env   = makeHostEnv({}, 0n, store, /*capBytes*/ 512);

    const bigBlob = buildBlob( { meta: Uint8Array.of(0), jumpTbl: Uint8Array.of(0), z: 1,
          instr: makeCode(1024), // make length big
          jumpEntries:[Uint8Array.of(0)],bitmaskBits: bitmask }
      );
  
    const st = runBlob (bigBlob, 100, { env, memInit: mem });
  
    expect(st.registers[7]).toBe(FULL);
    expect(env.getStorage!(digestFoo)).toBeUndefined();   // write rolled back
  });
});
