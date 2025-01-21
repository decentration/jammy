import { keccak_256 } from "js-sha3";

/**
 * mergePeaks(occumpant, newLeaf) from E2 of GP
 *
 *  - Produces a single keccak-256 hash from concatenating:
 *       left || right
 *    i.e. occupant + newLeaf.
 *  - occupant is put on the left; newLeaf on the right.
 *  - Returns the 32-byte hash as Uint8Array.
 *
 * Why do we do this?
 * -----------------
 * In MMR logic, when two peaks collide (i.e. they're both occupied),
 * we "merge" them by hashing them together, then carry that result
 * further up in the peaks array. This is standard carry-based MMR logic.
 */
function mergePeaks(left: Uint8Array, right: Uint8Array): Uint8Array {
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  const buf = keccak_256.arrayBuffer(combined);
  return new Uint8Array(buf);
}

/**
 * insertLeaf(peaks, newLeaf) Based off E2 of GP:
 *
 *  - “Carry-based” approach to putting a new leaf into the MMR peaks array.
 *  - Convert newLeaf to raw bytes
 *  - For i from 0..length(peaks):
 *      - If we run out of array (i >= length), push newLeaf at the end.
 *        Then break.
 *      - If peaks[i] == null, store newLeaf there & break.
 *      - Else peaks[i] is occupied, so merge occupant with newLeaf,
 *        set peaks[i] = null, and carry the merged result into next i.
 *   
 *
 * Why do we do this? 
 * -----------------
 * The MMR can be visualized as a carry-based structure: if a slot is empty,
 * put your item there; if it's occupied, merge them into one item and
 * carry that item to the next slot. Possibly you keep merging up until
 * we find an empty slot or we have to extend the array by one more peak.
 *
 * e.g. if peaks = [A, B, null], and we want to insert C then:
 *   - i=0 => A != null, hash of merge (A, C)=AC => peaks[0]=null
 *   - i=1 => B != null, hash of merge(B, AC)=BAC => peaks[1]=null
 *   - i=2 => null => store BAC => peaks[2] = BAC => done
 *
 * => final peaks: [ null, null, BAC ]
 */
export function insertLeaf(
  peaks: (string | Uint8Array | null)[],
  newLeaf: string | Uint8Array
): (Uint8Array | null)[] {

  // Convert newLeaf to raw bytes if needed
  let current = ensureBytes(newLeaf);

  // We'll store final array as (Uint8Array|null)
  const outPeaks = peaks.map(p => {
    if (p == null) return null;
    const b = ensureBytes(p);
    return b;
  }) as (Uint8Array | null)[];

  let i = 0;
  while (true) {

    // If we need to expand, do so and store current
    if (i >= outPeaks.length) {
      // Expand
      outPeaks.push(current);
      break;
    }

    // If empty, store current and break
    if (outPeaks[i] == null) {
      outPeaks[i] = current;
      break;
    } else {
      // Merge and continue
      const occupant = outPeaks[i]!;
      const merged = mergePeaks(occupant, current);
      outPeaks[i] = null;
      current = merged;
      i++;
    }
  }
  return outPeaks;
}


// If value is a hex string, parse it; else if val  is already Uint8Array, just return it. 
function ensureBytes(val: string | Uint8Array | null): Uint8Array {
    if (val == null) {
      return new Uint8Array(0);
    }
    if (typeof val !== "string") {
      // Already Uint8Array
      return val;
    }
    // else parse hex string
    let hex = val;
    if (hex.startsWith("0x")) {
      hex = hex.slice(2);
    }
    // ensure even length
    if (hex.length % 2 !== 0) {
      throw new Error(`ensureBytes: odd hex length? ${hex.length}`);
    }
  
    // Parse hex string into bytes
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) {
      const bytePair = hex.slice(i * 2, i * 2 + 2);
      out[i] = parseInt(bytePair, 16);
    }
    return out;
  }
  