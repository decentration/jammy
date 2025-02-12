import { keccak_256 } from "js-sha3";
import { MMRPeak } from "../stf/types";
import { toHex } from "../utils";
import { PEAK_PREFIX } from "../consts";
export function superPeaks(peaks: MMRPeak[]): Uint8Array {
  // 1) Filter out null
  const h = peaks.filter(p => p !== null) as Uint8Array[];

  // 2) If none => return zero-hash, or 32 zero bytes
  if (h.length === 0) {
    return new Uint8Array(32);
  }
  // 3) If exactly one => return that single peak
  if (h.length === 1) {
    return h[0];
  }
  // 4) Otherwise => domain-separate + recursion
  const allButLast = superPeaks(h.slice(0, -1));
  // console.log("allButLast", allButLast);
  const last = h[h.length - 1];
  // console.log("last", last);

  const prefix = new TextEncoder().encode(PEAK_PREFIX);
  const combined = new Uint8Array(prefix.length + allButLast.length + last.length);
  combined.set(prefix, 0);
  // console.log("prefix", prefix);
  combined.set(allButLast, prefix.length);
  // console.log("allButLast", allButLast);
  combined.set(last, prefix.length + allButLast.length);
  // console.log("last", last);

  const hashBytes = keccak_256.arrayBuffer(combined);
  console.log("prefix, combined", {prefix, combined, hashBytes});
 const hashBytesUint8 = new Uint8Array(hashBytes);
console.log("hashBytesUint8", toHex(hashBytesUint8));
  return hashBytesUint8;
}
