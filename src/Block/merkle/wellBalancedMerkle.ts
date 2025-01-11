import { sha256 } from "@noble/hashes/sha256";

/**
 * wellBalancedMerkle(items)
 * - Adheres toE.1.1 well-balanced approach (no duplication).
 * - If empty, we return 32 zero-bytes (assuming empty => zero-hash).
 * - If theres exactly 1 item, we hash it directly.
 * - Otherwise, split in half, build left and right subroots, then hash them combined.
 */
export function wellBalancedMerkle(items: Uint8Array[]): Uint8Array {
  // 1) If empty => zero-hash
  if (items.length === 0) {
    return new Uint8Array(32); // 32 zero bytes
  }

  // 2) If single item => sha256 item
  if (items.length === 1) {
    return sha256(items[0]);
  }

  // 3) For multiple items => split in half
  const mid = Math.floor(items.length / 2);

  const leftRoot = wellBalancedMerkle(items.slice(0, mid));
  const rightRoot = wellBalancedMerkle(items.slice(mid));

  // Combine the two subroots
  const combined = new Uint8Array(leftRoot.length + rightRoot.length);
  combined.set(leftRoot, 0);
  combined.set(rightRoot, leftRoot.length);

  // Return the hash of concatenating left + right sub-roots
  return sha256(combined);
}
