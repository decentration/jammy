import { makeHostEnv } from "../../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../../risc-pvm/interpreter/types";
import { NONE, WHO } from "../../../../risc-pvm/interpreter/host/consts";
import { loadImm, makeBlob, makeOpcodeBitmask, mkService } from "../helpers";
import { HEAP } from "../consts";
import { AccumulateX } from "../../../../risc-pvm/interpreter/host/types";

const GAS  = 500;
const KOFF = HEAP + 0x100;     // key bytes start
const VOFF = HEAP + 0x200;     // value bytes start
const OUT  = HEAP + 0x300;     // read-out destination

// test fixtures
const KEY         = new TextEncoder().encode("foo");
const VALUE_A     = new TextEncoder().encode("bar-baz");
const VALUE_B     = new TextEncoder().encode("baz-quux"); // overwrite value

describe("Storage lifecycle: ΩW -> ΩR -> ΩW(delete) -> ΩR", () => {
  // single payer xs with plenty of balance and threshold=0 (so ΩW gate won’t block)
  const xs = 0x1111_2222_3333_4444n;
  const env = makeHostEnv({
    initAcc: { allocator: { env: { currentServiceId: xs }, index: 0n } as AccumulateX }
  });
  env.putService(xs, mkService(0n, 0n, 1000n));

  const mem = new Uint8Array(1 << 20);
  mem.set(KEY,   KOFF);
  mem.set(VALUE_A, VOFF);

  it("[step 1] ΩW puts a new key->value; r7=NONE (no previous value)", () => {
    const prog = Uint8Array.of(
      ...loadImm(7,  KOFF), 
      ...loadImm(8,  KEY.length),
      ...loadImm(9,  VOFF),
      ...loadImm(10, VALUE_A.length),
      Opcodes.ecalli, 4,  // ΩW
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,6,12,18,24,26]);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });
    expect(st.exit?.type).toBe(ExitReasonType.Panic); 
    expect(st.registers[7]).toBe(NONE);  // first insert: no previous
  });

  it("[step 2] ΩR reads back the full value; r7=value length; OUT matches VALUE_A", () => {
    const prog = Uint8Array.of(
      ...[Opcodes.load_imm_64], 7, 0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,  // r7=NONE (xs)
      ...loadImm(8,  KOFF),             // key offset
      ...loadImm(9,  KEY.length),       // key length
      ...loadImm(10, OUT),              // destination
      ...loadImm(11, 0),                // f = 0
      ...loadImm(12, VALUE_A.length),   // l = VALUE_A length
      Opcodes.ecalli, 3,                // ΩR
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,10,16,22,28,34,40,42]);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(BigInt(VALUE_A.length));
    expect(st.memory.slice(OUT, OUT + VALUE_A.length)).toEqual(VALUE_A);
  });

  it("[step 3] ΩW overwrites same key with VALUE_B; r7=prev length (=VALUE_A.length)", () => {
    mem.set(new Uint8Array(VALUE_B.length).fill(0), VOFF); // clear old area
    mem.set(VALUE_B, VOFF);

    const prog = Uint8Array.of(
      ...loadImm(7,  KOFF),
      ...loadImm(8,  KEY.length),
      ...loadImm(9,  VOFF),
      ...loadImm(10, VALUE_B.length),
      Opcodes.ecalli, 4,   // ΩW
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,6,12,18,24,26]);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(BigInt(VALUE_A.length)); // return previous length
  });

  it("[step 4] ΩR reads a window (f,l) from VALUE_B; r7=VALUE_B length; bytes match slice", () => {
    const f = 2;                                 // offset into VALUE_B
    const l = VALUE_B.length - f;                // to end
    const expected = VALUE_B.slice(f, f + l);

    const prog = Uint8Array.of(
      ...[Opcodes.load_imm_64], 7, 0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, // r7=NONE (xs)
      ...loadImm(8,  KOFF),
      ...loadImm(9,  KEY.length),
      ...loadImm(10, OUT),
      ...loadImm(11, f),
      ...loadImm(12, l),
      Opcodes.ecalli, 3,    // ΩR
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,10,16,22,28,34,40,42]);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(BigInt(VALUE_B.length));
    expect(st.memory.slice(OUT, OUT + l)).toEqual(expected);
  });

  it("[step 5] ΩW deletes the key (vLen=0); r7=prev length; subsequent ΩR returns NONE", () => {
    // delete: same key, value length = 0
    const progDel = Uint8Array.of(
      ...loadImm(7,  KOFF),
      ...loadImm(8,  KEY.length),
      ...loadImm(9,  VOFF),
      ...loadImm(10, 0),     // vLen = 0 -> delete
      Opcodes.ecalli, 4,     // ΩW
      Opcodes.trap
    );
    const maskDel = makeOpcodeBitmask(progDel, [0,6,12,18,24,26]);

    const stDel = runBlob(makeBlob(progDel, maskDel), GAS, { env, memInit: mem });
    expect(stDel.exit?.type).toBe(ExitReasonType.Panic);
    expect(stDel.registers[7]).toBe(BigInt(VALUE_B.length)); // previous length returned

    // read after delete -> NONE
    const progReadAfter = Uint8Array.of(
      ...[Opcodes.load_imm_64], 7, 0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, // r7=NONE
      ...loadImm(8,  KOFF),
      ...loadImm(9,  KEY.length),
      ...loadImm(10, OUT),
      ...loadImm(11, 0),
      ...loadImm(12, 8),
      Opcodes.ecalli, 3,  // ΩR
      Opcodes.trap
    );
    const maskReadAfter = makeOpcodeBitmask(progReadAfter, [0,10,16,22,28,34,40,42]);

    const stAfter = runBlob(makeBlob(progReadAfter, maskReadAfter), GAS, { env, memInit: mem });
    expect(stAfter.exit?.type).toBe(ExitReasonType.Panic);
    expect(stAfter.registers[7]).toBe(NONE);
  });
});

describe("Storage edge-cases", () => {
  it("ΩW with no current service (xs) in context ⇒ WHO", () => {
      const mem = new Uint8Array(1<<20);
      const KEY = new TextEncoder().encode("foo");
      const VAL = new TextEncoder().encode("bar");
      const KOFF = 0x18000, VOFF = 0x18200;
      mem.set(KEY, KOFF); mem.set(VAL, VOFF);
    
      // no xs currentServiceId in the accumulate context:
      const env = makeHostEnv({ initAcc: { allocator: { env: {}, index: 0n } as AccumulateX } });
    
      const prog = Uint8Array.of(
        ...loadImm(7,  KOFF), 
        ...loadImm(8,  KEY.length),
        ...loadImm(9,  VOFF),
        ...loadImm(10, VAL.length),
        Opcodes.ecalli, 4,  // ΩW
        Opcodes.trap
      );
      const mask = makeOpcodeBitmask(prog, [0,6,12,18,24,26]);
    
      const st = runBlob(makeBlob(prog, mask), 200, { env, memInit: mem });
      expect(st.registers[7]).toBe(WHO);
  });
      
});
