export function makeOpcodeBitmask(code: Uint8Array, opcodeOffsets: number[]): Uint8Array {
  const bits = new Uint8Array(Math.ceil(code.length / 8));
  for (const off of opcodeOffsets) bits[off >> 3] |= 1 << (off & 7);
  return bits;
}