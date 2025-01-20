import { validateBlock } from "./validateBlock"; 
import { Block } from "../../types/types";
import { State } from "../../state/types";

/**
 * A minimal offline block import:
 * 1) validate the child block
 * 2) apply STF to preState using extrinsics in block
 * 3) return the new postState
 */
export function importBlock(preState: State, parentBlock: Block, childBlock: Block): State {
  // 1) Validate child block
  validateBlock(childBlock, parentBlock);

  // 2) apply STF
  const postState = structuredClone(preState);

  // As MVP minimal "tickets" logic
  // a) timeslot => block.header.slot
  postState.timeslotIndex.index = childBlock.header.slot;

  // b) if tickets extrinsic => add to gamma_a
  childBlock.extrinsic.tickets.forEach((t) => {
    postState.gamma.gamma_a.push(t.signature);
  });

  // TODO  add preimages, disputes, etc...

  return postState;
}
