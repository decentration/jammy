import { encodeProtocolInt, decodeProtocolInt } from "../../codecs";

const boundaries: [bigint, number][] = [
  [0n, 1],
  [1n, 1],
  [127n, 1],                          // 2⁷ − 1
  [128n, 2],
  [16383n, 2],                        // 2¹⁴ − 1
  [16384n, 3],
  [2_097_151n, 3],                    // 2²¹ − 1
  [2_097_152n, 4],
  [268_435_455n, 4],  
  [268_435_456n, 5],
  [(1n << 35n) - 1n, 5],             // 2³⁵ − 1
  [1n << 35n, 6],
  [(1n << 42n) - 1n, 6],             // 2⁴² − 1
  [1n << 42n, 7],
  [(1n << 49n) - 1n, 7],             // 2⁴⁹ − 1
  [1n << 49n, 8],
  [(1n << 56n) - 1n, 8],             // 2⁵⁶ − 1
  [1n << 56n, 9],
  [(1n << 64n) - 1n, 9],             // 2⁶⁴ − 1
];

describe("protocol-int round-trip", () => {
    it.each(boundaries)("%s", (x) => {
      const enc = encodeProtocolInt(x);
      const { value, bytesRead } = decodeProtocolInt(enc);
      expect(value).toBe(x);
      expect(bytesRead).toBe(enc.length);
    });
  });
  
  describe("encoded length matches spec", () => {
    it.each(boundaries)("%s → %d bytes", (x, expected) => {
      expect(encodeProtocolInt(x).length).toBe(expected);
    });
  });