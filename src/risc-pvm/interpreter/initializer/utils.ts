// read N bytes as unsigned int; return [value, newOffset] or null on OOB
export function readN(
  data: Uint8Array,
  offset: number,
  length: number,
  littleEndian: boolean
): [number, number] | null {
  if (offset + length > data.length) return null;
  let v = 0;
  if (littleEndian) {
    for (let i = length - 1; i >= 0; i--) v = (v << 8) | data[offset + i];
  } else {
    for (let i = 0; i < length; i++) v = (v << 8) | data[offset + i];
  }
  return [v >>> 0, offset + length];
}