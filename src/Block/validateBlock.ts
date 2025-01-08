import { generateBlockHash } from "./serializeBlock";
import { Block } from "../types/types";
import { toHexToggle } from "../utils";

export function validateBlock(child: Block, parent: Block): void {
  // Validate parent hash
  const expectedParentHash = generateBlockHash(parent);
  const actualParentHash = toHexToggle(child.header.parent);

  if (actualParentHash !== expectedParentHash) {
    throw new Error(
      `validateBlock: parent-hash mismatch. Expected ${expectedParentHash}, got ${actualParentHash}`
    );
  }

  // Validate slot increment
  if (child.header.slot !== parent.header.slot + 1) {
    throw new Error(
      `validateBlock: slot mismatches. Expected ${parent.header.slot + 1}, got ${child.header.slot}`
    );
  }

  // TODO... more checks?
}
