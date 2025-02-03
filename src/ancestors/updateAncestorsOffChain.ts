import { ancestorKey } from "./helpers";
import { AncestorsInput, AncestorsOffChainState } from "./types";

// TODO: apply this to import or build block pipeline

/**
 * updateAncestorsOffChain:
 *   - For each new block in input.newBlocks:
 *       1) Insert it into blocks[] if not present
 *       2) Evict any that are older than (currentSlot - maxCapacity)
 *   - Return updated offChainState
 */
export function updateAncestorsOffChain(
    offChainState: AncestorsOffChainState,
    input: AncestorsInput
  ): AncestorsOffChainState {
    // 1) clone 
    const state = structuredClone(offChainState) as AncestorsOffChainState;
    const { blocks, indexMap, maxCapacity } = state;
    const { newBlocks, currentSlot } = input;
  
    // 2) Evict older blocks 
    const minAllowedSlot = currentSlot - maxCapacity;
    
    // Eviction pass in a loop, if there might be multiple old block
    while (blocks.length > 0 && blocks[0].slot < minAllowedSlot) {
      const oldItem = blocks.shift()!;  // remove from front
      const oldKey = ancestorKey(oldItem.slot, oldItem.header_hash);
      indexMap.delete(oldKey);
    }
  
    // 3) Insert each new block
    for (const newBlock of newBlocks) {
      const key = ancestorKey(newBlock.slot, newBlock.header_hash);
      // If we already have it, skip
      if (!indexMap.has(key)) {
        // Insert
        blocks.push(newBlock);
        indexMap.set(key, blocks.length - 1);
      }
    }

    // 4) If we exceed capacity, also do an additional check
    while (blocks.length > maxCapacity) {
        const oldItem = blocks.shift()!;
        indexMap.delete(ancestorKey(oldItem.slot, oldItem.header_hash));
    }

    return state;
    }