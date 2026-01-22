import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { NONE, FULL, BS, BI, BL } from "../../../risc-pvm/interpreter/host/consts";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { hash } from "../../../utils/crypto";
import { makeAcc, makeBlob, mkService } from "./helpers";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";

const KEY_ADDR = 0x18000;
const VAL_ADDR = 0x19000;
const BAD_ADDR = 0x20000; // address outside the memory range
const CUR = 0xffff_ffffn;

// GP 9.8
const STORAGE_OVERHEAD = 34n;

function computeExpectedThreshold(xs: ServiceAccount): bigint {
  const preimageCount = BigInt(xs.preimages?.size ?? 0);
  const storageCount = BigInt(xs.storage?.size ?? 0);
  const ai = 2n * preimageCount + storageCount;

  let ao = 0n;
  if (xs.preimages) {
    for (const [_hash, blob] of xs.preimages) {
      ao += 81n + BigInt(blob.length);
    }
  }
  if (xs.storage) {
    for (const [keyHex, value] of xs.storage) {
      const keyLen = BigInt(keyHex.length / 2);
      ao += STORAGE_OVERHEAD + keyLen + BigInt(value.length);
    }
  }

  return BigInt(BS) + BigInt(BI) * ai + BigInt(BL) * ao;
}

function makeCode(vLen: number, kOff: number, kLen: number, vOff: number): Uint8Array {
  return Uint8Array.of(
    // r7..r10 = [kO, kZ, vO, vZ] - each load_imm is 6 bytes (opcode + reg + 4-byte imm)
    Opcodes.load_imm, 7, kOff & 255, (kOff >> 8) & 255, (kOff >> 16) & 255, (kOff >> 24) & 255,   // 0-5
    Opcodes.load_imm, 8, kLen & 255, (kLen >> 8) & 255, (kLen >> 16) & 255, (kLen >> 24) & 255,   // 6-11
    Opcodes.load_imm, 9, vOff & 255, (vOff >> 8) & 255, (vOff >> 16) & 255, (vOff >> 24) & 255,   // 12-17
    Opcodes.load_imm, 10, vLen & 255, (vLen >> 8) & 255, (vLen >> 16) & 255, (vLen >> 24) & 255,  // 18-23
    Opcodes.ecalli, 4, 0,  // ΩW - 3 bytes: opcode + 2-byte LE immediate (SDK format)            // 24-26
    Opcodes.trap           // 1 byte                                                              // 27
  );
}
const code = makeCode(6, KEY_ADDR, 3, VAL_ADDR);
// Bitmask for 28 bytes: opcodes at positions 0, 6, 12, 18, 24, 27
// Byte 0 (bits 0-7):  0b0100_0001 = positions 0, 6
// Byte 1 (bits 8-15): 0b0001_0000 = position 12
// Byte 2 (bits 16-23): 0b0000_0100 = position 18
// Byte 3 (bits 24-31): 0b0000_1001 = positions 24, 27
const bitmask = Uint8Array.of(0b0100_0001, 0b0001_0000, 0b0000_0100, 0b0000_1001);
const blob = buildBlob({ meta: Uint8Array.of(0), z: 1, instr: code, jumpEntries: [Uint8Array.of(0)], bitmaskBits: bitmask });

const fooKey = Uint8Array.from([0x66, 0x6f, 0x6f]);
// Raw key hex for storage lookup (handler uses raw bytes converted to hex)
const rawKeyHex = Buffer.from(fooKey).toString("hex"); // "666f6f"

// Hashed key for validating staged deltas (allocator uses hashed keys)
const prefix32 = toLE(BigInt.asUintN(32, CUR), 4);
const prefixed = new Uint8Array(prefix32.length + fooKey.length);
prefixed.set(prefix32, 0);
prefixed.set(fooKey, prefix32.length);

const digestFoo = hash(prefixed);
const hKeyHex = Buffer.from(digestFoo).toString("hex");


describe("ΩW write handler", () => {
  it("insert new key -> r7=NONE, value stored", () => {
    const mem = new Uint8Array(1 << 20); // 1 mb
    mem.set([0x66, 0x6f, 0x6f], KEY_ADDR);  // key "foo"
    mem.set([1, 2, 3, 4, 5, 6], VAL_ADDR); // value

    // Calculate what threshold will be after this write
    // New entry: a_i = 1 (one storage entry), a_o = 34 + 3 + 6 = 43
    // a_t = BS(100) + BI(10) * 1 + BL(1) * 43 = 100 + 10 + 43 = 153
    const expectedThresholdAfterWrite = 153n;

    const env = makeHostEnv({ initAcc: makeAcc(CUR) });
    env.putService(CUR, mkService(CUR, 0n, 1000n));  // balance 1000 > 153 threshold

    const st = runBlob(blob, 100n, { env, memInit: mem, strictVm: false });

    expect(st.registers[7]).toBe(NONE);
    // Verify storage write was staged (handler uses env.putStorage which tracks staged writes)
    const writes = env.getStagedStorageWrites!();
    const write = writes.find(w => Buffer.from(w.key).toString('hex') === rawKeyHex);
    expect(write).toBeTruthy();
    expect(write!.value).toEqual(Uint8Array.from([1, 2, 3, 4, 5, 6]));
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("dest key unmapped -> r7=Panic", () => {
    const mem = new Uint8Array(1 << 20);           // no key bytes loaded


    const kOff = mem.length - 4; // near end
    const kLen = 8;           // will run past end => OOB
    const vOff = 0x1000;
    const vLen = 6;

    const code = makeCode(vLen, kOff, kLen, vOff);


    const env = makeHostEnv({ initAcc: makeAcc(CUR) });
    env.putService(CUR, mkService(CUR, 0n, 0n));


    const st = runBlob(makeBlob(code, bitmask), 100n, { env, memInit: mem, strictVm: false });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(env.acc.allocator.env.deltas.has(CUR)).toBe(false);
  });

  it("insert new key -> r7=FULL when balance too low for threshold", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(fooKey, KEY_ADDR);
    mem.set([1, 2, 3, 4, 5, 6], VAL_ADDR);

    // After this write: a_i = 1, a_o = 34 + 3 + 6 = 43
    // a_t = 100 + 10 * 1 + 1 * 43 = 153
    // Set balance to 100, which is less than 153 threshold
    const env = makeHostEnv({ initAcc: makeAcc(CUR) });
    env.putService(CUR, mkService(CUR, 0n, 100n)); // balance 100 < 153 threshold

    const st = runBlob(makeBlob(code, bitmask), 100n, { env, memInit: mem, strictVm: false });

    expect(st.registers[7]).toBe(FULL);
    // Verify no storage write was staged
    const writes = env.getStagedStorageWrites!();
    expect(writes.length).toBe(0);
  });

  it("update existing key -> r7=FULL when balance too low after value growth", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(fooKey, KEY_ADDR);
    // Writing 6 bytes to replace existing 3 bytes
    mem.set([1, 2, 3, 4, 5, 6], VAL_ADDR);

    // Pre-populate storage in env and service account
    const initialStorage = new Map<string, Uint8Array>();
    initialStorage.set(rawKeyHex, Uint8Array.from([9, 9, 9])); // 3 bytes
    const env = makeHostEnv({ initAcc: makeAcc(CUR), storage: initialStorage });

    // Pre-populate with a small value (3 bytes)
    const xs0 = mkService(0n, 0n);
    xs0.storage.set(rawKeyHex, Uint8Array.from([9, 9, 9])); // 3 bytes

    // Current: a_i = 1, a_o = 34 + 3 + 3 = 40 (rawKeyHex is 6 chars = 3 bytes)
    // After:   a_i = 1, a_o = 34 + 3 + 6 = 43
    // Threshold before = 100 + 10 + 40 = 150
    // Threshold after  = 100 + 10 + 43 = 153
    // Set balance to 151 - between current and new threshold
    xs0.balance = 151n;
    env.putService(CUR, xs0);

    const st = runBlob(blob, 100n, { env, memInit: mem, strictVm: false });

    expect(st.registers[7]).toBe(FULL);
    // Verify no storage write was staged
    const writes = env.getStagedStorageWrites!();
    expect(writes.length).toBe(0);

    // Committed state remains unchanged
    const committed = env.getService(CUR) as ServiceAccount;
    expect(Buffer.from(committed.storage.get(rawKeyHex)!)).toEqual(Buffer.from([9, 9, 9]));
  });

  it("update existing key -> r7=prevLen when balance sufficient", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(fooKey, KEY_ADDR);
    mem.set([1, 2, 3, 4, 5, 6], VAL_ADDR);

    // Pre-populate storage in env and service account
    const initialStorage = new Map<string, Uint8Array>();
    initialStorage.set(rawKeyHex, Uint8Array.from([9, 9, 9]));
    const env = makeHostEnv({ initAcc: makeAcc(CUR), storage: initialStorage });

    // Prepopulate with a small value
    const xs0 = mkService(0n, 0n);
    xs0.storage.set(rawKeyHex, Uint8Array.from([9, 9, 9]));
    xs0.balance = 500n;
    env.putService(CUR, xs0);

    const st = runBlob(blob, 100n, { env, memInit: mem, strictVm: false });

    // Should return previous value length (3)
    expect(st.registers[7]).toBe(3n);

    // Value should be updated - check staged writes
    const writes = env.getStagedStorageWrites!();
    const write = writes.find(w => Buffer.from(w.key).toString('hex') === rawKeyHex);
    expect(write).toBeTruthy();
    expect(write!.value).toEqual(Uint8Array.from([1, 2, 3, 4, 5, 6]));
  });

  it("delete key (vLen=0) -> no threshold check needed", () => {
    const mem = new Uint8Array(1 << 20);
    mem.set(fooKey, KEY_ADDR);

    // Make code with vLen=0 (delete)
    const deleteCode = makeCode(0, KEY_ADDR, 3, VAL_ADDR);

    // Pre-populate storage in env and service account
    const initialStorage = new Map<string, Uint8Array>();
    initialStorage.set(rawKeyHex, Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    const env = makeHostEnv({ initAcc: makeAcc(CUR), storage: initialStorage });

    // Set up account with existing storage and low balance
    const xs0 = mkService(0n, 0n);
    xs0.storage.set(rawKeyHex, Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]));
    xs0.balance = 0n; // Very low balance - but delete should still work
    env.putService(CUR, xs0);

    const st = runBlob(makeBlob(deleteCode, bitmask), 100n, { env, memInit: mem, strictVm: false });

    // Should return previous value length (10)
    expect(st.registers[7]).toBe(10n);
  });

  it("computeExpectedThreshold matches protocol computation", () => {
    const svc = mkService(0n, 0n);
    svc.storage.set("aabbccdd", Uint8Array.from([1, 2, 3])); // 4-byte key, 3-byte value
    svc.preimages.set("00112233", Uint8Array.from([4, 5, 6, 7, 8])); // 5-byte blob

    // a_i = 2 * 1 + 1 = 3
    // a_o = (81 + 5) + (34 + 4 + 3) = 86 + 41 = 127
    // a_t = 100 + 10 * 3 + 1 * 127 = 100 + 30 + 127 = 257
    expect(computeExpectedThreshold(svc)).toBe(257n);
  });
});
