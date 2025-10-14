import { buildBlob }       from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv }     from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes }         from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }         from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }  from "../../../risc-pvm/interpreter/types";
import { NONE, FULL } from "../../../risc-pvm/interpreter/host/consts";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { hash } from "../../../utils/crypto";
import { makeAcc, makeBlob, mkService } from "./helpers";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";

const KEY_ADDR = 0x18000;
const VAL_ADDR = 0x19000;
const BAD_ADDR = 0x20000; // address outside the memory range
const CUR      = 0xffff_ffffn;

function makeCode(vLen: number, kOff: number, kLen: number, vOff: number): Uint8Array {
  return Uint8Array.of(
    // r7..r10 = [kO, kZ, vO, vZ]
    Opcodes.load_imm, 7,  kOff & 255, (kOff>>8)&255, (kOff>>16)&255, (kOff>>24)&255,
    Opcodes.load_imm, 8,  kLen & 255, (kLen>>8)&255, (kLen>>16)&255, (kLen>>24)&255,
    Opcodes.load_imm, 9,  vOff & 255, (vOff>>8)&255, (vOff>>16)&255, (vOff>>24)&255,
    Opcodes.load_imm, 10, vLen & 255, (vLen>>8)&255, (vLen>>16)&255, (vLen>>24)&255,
    Opcodes.ecalli, 4,  // ΩW
    Opcodes.trap
  );
}
const code = makeCode(6, KEY_ADDR, 3, VAL_ADDR);
const bitmask = Uint8Array.of(0b0100_0001,0b0001_0000,0b0000_0100,0b0000_0101);
const blob = buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1, instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

const fooKey = Uint8Array.from([0x66, 0x6f, 0x6f]);

const prefix32 = toLE(BigInt.asUintN(32, CUR), 4);
const prefixed = new Uint8Array(prefix32.length + fooKey.length);
prefixed.set(prefix32, 0);
prefixed.set(fooKey, prefix32.length);

const digestFoo = hash(prefixed);
const hKeyHex = Buffer.from(digestFoo).toString("hex");


describe("ΩW write handler", () => {
  it("insert new key -> r7=NONE, value stored", () => {
    const mem = new Uint8Array(1<<20); // 1 mb
    mem.set([0x66,0x6f,0x6f], KEY_ADDR);  // key "foo"
    mem.set([1,2,3,4,5,6], VAL_ADDR); // value


    const env = makeHostEnv({ initAcc: makeAcc(CUR) });
    env.putService(CUR, mkService(0n, 1000n)); 
    
    const st = runBlob(blob, 100n, { env, memInit: mem });

    expect(st.registers[7]).toBe(NONE);
    const stagedXs = env.acc.allocator.env.deltas.get(CUR) as ServiceAccount;
    expect(stagedXs).toBeTruthy();
    expect(stagedXs.storage.get(hKeyHex)).toEqual(Uint8Array.from([1,2,3,4,5,6]));
    expect(st.exit?.type).toBe(ExitReasonType.Panic); 
  });

  it("dest key unmapped -> r7=Panic", () => {
    const mem = new Uint8Array(1<<20);           // no key bytes loaded


    const kOff = mem.length - 4; // near end
    const kLen = 8;           // will run past end => OOB
    const vOff = 0x1000;
    const vLen= 6;

    const code    = makeCode(vLen, kOff, kLen, vOff);


    const env = makeHostEnv({ initAcc: makeAcc(CUR) });
    env.putService(CUR, mkService(0n, 0n));


    const st   = runBlob(makeBlob(code, bitmask), 100n, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);  
        expect(env.acc.allocator.env.deltas.has(CUR)).toBe(false);

  });

  it("store FULL -> r7=FULL, value not written", () => {
    const mem = new Uint8Array(1<<20);
    mem.set(fooKey, KEY_ADDR);
    mem.set([1,2,3,4,5,6], VAL_ADDR);

    const env = makeHostEnv({ initAcc: makeAcc(CUR) });

    env.putService(CUR, mkService(0n, 10n, 20n, { threshold: 30n }));
    const st   = runBlob(makeBlob(code, bitmask), 100n, { env, memInit: mem });

    expect(st.registers[7]).toBe(FULL);
    const staged = env.acc.allocator.env.deltas.get(CUR) as ServiceAccount | undefined;
    expect(!staged || !staged.storage.has(hKeyHex)).toBe(true);
  });


  it("store FULL -> r7 = FULL (ΩW)", () => {

    const mem = new Uint8Array(1<<20);
    mem.set(fooKey, KEY_ADDR);

    const env = makeHostEnv({ initAcc: makeAcc(CUR) })

    const xs0 = mkService(0n, 0n);
    xs0.threshold = 100n;  // ensure threshold (100) > a_b (0) -> FULL

    xs0.storage.set(hKeyHex, Uint8Array.from([9,9,9]));
    env.putService(CUR, xs0);

    // const bigBlob = buildBlob( { meta: Uint8Array.of(0), jumpTbl: Uint8Array.of(0), z: 1,
    //       instr: makeCode(1024), // make length big
    //       jumpEntries:[Uint8Array.of(0)],bitmaskBits: bitmask }
    //   );
  
    const st = runBlob(blob, 100n, { env, memInit: mem });

    expect(st.registers[7]).toBe(FULL); // FULL branch
    expect(env.acc.allocator.env.deltas.has(CUR)).toBe(false); // stagin should not occur
    
    const committed = env.getService(CUR) as ServiceAccount;
    expect(Buffer.from(committed.storage.get(hKeyHex)!)).toEqual(Buffer.from([9,9,9]));  // committed state remains unchanged

  });
});
