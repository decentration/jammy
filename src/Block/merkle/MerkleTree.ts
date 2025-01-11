import { sha256 } from "@noble/hashes/sha256";

/**
 * E.1 of JAM Build a binary Merkle tree and return the root.
 * @param {Uint8Array[]} leaves - Array of hashed leaves.
 * @returns {Uint8Array} The Merkle root.
 * If the input array is empty, the zero-hash is returned.
 * If the number of leaves is odd, the last leaf is duplicated.
 */
export function buildBinaryMerkleTree(leaves: Uint8Array[]): Uint8Array {
  if (leaves.length === 0) {
    return new Uint8Array(32); // Return zero-hash for empty inputs
  }
  if (leaves.length === 1) {
    return leaves[0]; // Single leaf is the root
  }

  // Ensure even number of leaves
  if (leaves.length % 2 === 1) {
    leaves.push(leaves[leaves.length - 1]);
  }

  const nextLevel: Uint8Array[] = [];
  for (let i = 0; i < leaves.length; i += 2) {
    const combined = new Uint8Array(leaves[i].length + leaves[i + 1].length);
    combined.set(leaves[i], 0);
    combined.set(leaves[i + 1], leaves[i].length);
    nextLevel.push(sha256(combined));
  }

  return buildBinaryMerkleTree(nextLevel);
}