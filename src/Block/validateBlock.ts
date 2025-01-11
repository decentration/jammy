import { generateBlockHash } from "./serializeBlock";
import { Block } from "../types/types";
import { toHexToggle } from "../utils";
import { computeExtrinsicsMerkleRoot } from "./merkle/computeExtrinsicsMerkleRoot";

export function validateBlock(child: Block, parent: Block): void {
  // 1 - Validate parent hash
  const expectedParentHash = generateBlockHash(parent);
  const actualParentHash = toHexToggle(child.header.parent);

  if (actualParentHash !== expectedParentHash) {
    throw new Error(
      `validateBlock: parent-hash mismatch. Expected ${expectedParentHash}, got ${actualParentHash}`
    );
  }

  // 2 - Validate slot increment
  if (child.header.slot !== parent.header.slot + 1) {
    throw new Error(
      `validateBlock: slot mismatches. Expected ${parent.header.slot + 1}, got ${child.header.slot}`
    );
  }

  // 3 - Validate extrinsic hash
  const computedExtrinsicHash = computeExtrinsicsMerkleRoot(child.extrinsic);
  if (!arraysEqual(child.header.extrinsic_hash, computedExtrinsicHash)) {
    throw new Error(`validateBlock: extrinsic-hash mismatch!`);
  }

  // TODO... more checks?
}

// Helper function to compare two Uint8Arrays
function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    return a.every((val, i) => val === b[i]);
  }