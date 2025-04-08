import { MAX_BLOCKS_HISTORY } from "../../consts";
import { HistoryState, HistoryInput, BlockItem } from "../types";
import { insertLeaf } from "../../mmr/mergePeaks";

/**
 * applyHistoryStf: 
 *   - Clones old MMR
 *   - Insert newLeaf = input.accumulate_root
 *   - Creates new block with updated MMR
 *   - Leaves the old block of MMR as is
 */
export function applyHistoryStf(
    preState: HistoryState,
    input: HistoryInput
  ): { output: null; postState: HistoryState } {
    // 1) Copy preState => postState
    const postState = structuredClone(preState) as HistoryState;
  
    // 2) If there's an existing block, fix its state_root but DONT mutate MMR
    if (postState.beta.length > 0) {
      const lastIndex = postState.beta.length - 1;
      postState.beta[lastIndex].state_root = input.parent_state_root;
    }
  
    // 3) Clone old peaks so we dont overwrite parent block's MMR
    let oldPeaks: (Uint8Array | null)[] = [];
    if (postState.beta.length > 0) {
      oldPeaks = structuredClone(
        postState.beta[ postState.beta.length - 1 ].mmr.peaks
      );
    }
  
    // console.log("Old peaks:", oldPeaks);
    // console.log("New leaf:", input.accumulate_root);

    // 4) Insert the new accumulate_root => partial merges
    const newPeaks = insertLeaf(oldPeaks, input.accumulate_root);
  
    // 5) Create new block with updated MMR
    const newBlockEntry: BlockItem  = {
      header_hash: input.header_hash,
      mmr: { peaks: newPeaks },
      state_root: new Uint8Array(32).fill(0),
      reported: input.work_packages.map((wp) => ({
        hash: wp.hash,
        exports_root: wp.exports_root,
      })),
    };
  
    // 6) Append new block => old remains as in pre_state
    postState.beta.push(newBlockEntry);


    // 7) Trim history if needed
    const H = MAX_BLOCKS_HISTORY;

    if (postState.beta.length > H) {
        postState.beta.shift(); // remove oldest block
      }

    // output=null
    return { output: null, postState };
  }
  