import { validateBlock } from "./validateBlock"; 
import { Block } from "../../types/types";
import { State } from "../../state/types";
import { toHex } from "../../utils";
import { computeMerkleRoot } from "../../state/commit";

/**
 * A minimal offline block import:
 * 1) validate the child block
 * 2) apply STF to preState using extrinsics in block
 * 3) return the new postState
 */
export function importBlock(
  preState: State, 
  parentBlock: Block, 
  childBlock: Block
): { postState: State; newRoot: Uint8Array } {
  // 1) Validate child block
  validateBlock(childBlock, parentBlock);

  // 2) build the preState root
  const { kvs, root: preRoot, db: db0 } = computeMerkleRoot(preState);

  if (toHex(preRoot) !== toHex(childBlock.header.parent_state_root).replace(/^0x/, "")) {
    throw new Error("parent_state_root mismatch – block built on the wrong state");
  }

  // 3) Apply STF  (execute extrinsics/ tickets / accumulate, etc)
  const postState = applyExtrinsics(structuredClone(preState), childBlock.extrinsic);

  // 4) Compute new root
  const { kvs: kvs1, root: postRoot, db: db1 } = computeMerkleRoot(postState);


  return { postState, newRoot: postRoot };

}
