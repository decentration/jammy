import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { buildFetchConfigVector } from "../../../risc-pvm/interpreter/host/helpers";
import { GA, GI, GR, GT } from "../../../risc-pvm/interpreter/host/consts";

const le = (n: bigint) => Array.from(toLE(n, 8));

describe("toLE(..., 8) edge cases", () => {
  it("encodes 0n as eight zero bytes", () => {
    expect(le(0n)).toEqual([0,0,0,0,0,0,0,0]);
  });

  it("encodes 1n with LSB first", () => {
    expect(le(1n)).toEqual([1,0,0,0,0,0,0,0]);
  });

  it("encodes max uint64 (2^64-1) as eight 0xFF", () => {
    const max = (1n << 64n) - 1n;
    expect(le(max)).toEqual([255,255,255,255,255,255,255,255]);
  });

  it("encodes a mixed-nybble value correctly (0x0123456789ABCDEF)", () => {
    const v = 0x0123456789ABCDEFn;
    expect(le(v)).toEqual([0xEF,0xCD,0xAB,0x89,0x67,0x45,0x23,0x01]);
  });

  it("encodes > 2^32 values fully (5,000,000,000)", () => {
    const encoded = le(5_000_000_000_000_000n);
    expect(le(5_000_000_000_000_000n)).toEqual(encoded);
  });
});

describe("ΩY config vector 64-bit slots (GA/GI/GR/GT)", () => {
  // bytes: BI(8) BL(8) BS(8) C(4) D(4) E(4) -> GA at 36
  const OFF_GA = 36;
  const OFF_GI = OFF_GA + 8;
  const OFF_GR = OFF_GI + 8;
  const OFF_GT = OFF_GR + 8;

  it("has stable total length", () => {
    const cfg = buildFetchConfigVector();
    expect(cfg.length).toBe(164); // sum of part sizes in builder
  });

  it("encodes GA as u64 little-endian", () => {
    const cfg = buildFetchConfigVector();
    const got = Array.from(cfg.slice(OFF_GA, OFF_GA + 8));
    const exp = le(BigInt(GA));
    expect(got).toEqual(exp);
  });

  it("encodes GI as u64 little-endian", () => {
    const cfg = buildFetchConfigVector();
    const got = Array.from(cfg.slice(OFF_GI, OFF_GI + 8));
    const exp = le(BigInt(GI));
    expect(got).toEqual(exp);
  });

  it("encodes GR (> 2^32) without truncation", () => {
    const cfg = buildFetchConfigVector();
    const got = Array.from(cfg.slice(OFF_GR, OFF_GR + 8));
    const exp = le(BigInt(GR));
    expect(got).toEqual(exp);

    // sanity: if someone had used x>>>0, the high dword would be zero here — I assert it’s 0x01.
    expect(got[4]).toBe(0x01);
  });

  it("encodes GT (> 2^32) without truncation", () => {
    const cfg = buildFetchConfigVector();
    const got = Array.from(cfg.slice(OFF_GT, OFF_GT + 8));
    const exp = le(BigInt(GT));
    expect(got).toEqual(exp);

    // GT = 3,500,000,000 = 0x00000000_D09DC300, high dword is 0
    expect(got.slice(4)).toEqual([0,0,0,0]);
  });
});
