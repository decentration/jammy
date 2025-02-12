import { blake2b } from "blakejs";
import { MMRPeak } from "../stf/types";

/**
 * Computes the Beefy root from the given peaks.
 * @param peaks
 * @returns 
 */
export function computeBeefyRoot(peaks: MMRPeak[]): Uint8Array {
  // Filter out null:
  const filtered = peaks.filter(p => p !== null) as Uint8Array[];
  const concatenated = new Uint8Array(filtered.reduce((acc, cur) => acc + cur.length, 0));
  let offset = 0;
  for (const p of filtered) {
    concatenated.set(p, offset);
    offset += p.length;
  }
  const hashBytes = blake2b(concatenated, undefined, 32 );
  return hashBytes;
}
