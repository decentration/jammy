import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { INFO_BYTES } from "../../../risc-pvm/interpreter/host/consts";
import { encodeInfoHelper } from "../../../risc-pvm/interpreter/host/helpers";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";

const zeroServiceAcc: ServiceAccount = {
  rootCodeHash : 0n,
  balance      : 0n,
  ticketNext   : 0n,
  gasAccumulate: 0n,
  gasOnTransfer: 0n,
  coresOffset  : 0,
  ticketIndex  : 0,
  storage      : new Map(),
  preimages    : new Map(),
  lookupStorage: new Map<string, Uint8Array>(),
  cores        : new Uint8Array(),
  selectorMap  : new Map()
} as const;

describe("encodeInfoHelper", () => {
  it("all-zeros -> INFO_BYTES zeroes", () => {
    const enc = encodeInfoHelper(zeroServiceAcc);
    expect(enc.length).toBe(INFO_BYTES);
    expect(Array.from(enc).every(b => b === 0)).toBe(true);
  });

  it("encodes 128-bit balance correctly (lo & hi limbs)", () => {
    const BAL = (1n << 96n) + 0xAABBCCDDEEFF0011n;      // hi-32-bits = 0x1
    const sa  = { ...zeroServiceAcc, balance: BAL };
    const enc = encodeInfoHelper(sa);

    const lo = BAL & 0xFFFF_FFFF_FFFF_FFFFn;
    const hi = BAL >> 64n;

    // bytes 32-39 = lo-limb (little-endian)
    expect(enc.slice(32, 40)).toEqual(toLE(lo, 8));
    // bytes 40-47 = hi-limb (little-endian)
    expect(enc.slice(40, 48)).toEqual(toLE(hi, 8));
  });

  it("encodes rootCodeHash into first 32 bytes", () => {
    const HASH = 0x1122334455667788n;
    const sa   = { ...zeroServiceAcc, rootCodeHash: HASH };
    const enc  = encodeInfoHelper(sa);

    const ref  = new Uint8Array(32);
    ref.set(toLE(HASH, 8));    // lowest 8 bytes populated
    expect(enc.slice(0, 32)).toEqual(ref);
  });

  it("encodes all remaining scalar fields", () => {
    const sa = {
      ...zeroServiceAcc,
      ticketNext   : 0xdeadbeefcafebaben,
      gasAccumulate: 0x123456789ABCDEFn,
      gasOnTransfer: 0x0fedcba987654321n,
      coresOffset  : 4096,
      ticketIndex  : 77
    };
    const enc = encodeInfoHelper(sa);

    expect(enc.slice(48, 56)).toEqual(toLE(sa.ticketNext, 8));  // tt
    expect(enc.slice(56, 64)).toEqual(toLE(sa.gasAccumulate, 8));  // tg
    expect(enc.slice(64, 72)).toEqual(toLE(sa.gasOnTransfer, 8));  // tm
    expect(enc.slice(72, 76)).toEqual(toLE(BigInt(sa.coresOffset), 4)); // to
    expect(enc.slice(76, 80)).toEqual(toLE(BigInt(sa.ticketIndex), 4)); // ti
  });
});
