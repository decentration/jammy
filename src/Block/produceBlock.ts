import { Block, ExtrinsicData } from "../types/types";
import { generateBlockHash } from "./serializeBlock";
import { computeExtrinsicsMerkleRoot } from "./merkle/computeExtrinsicsMerkleRoot";
import { isEpochBoundary, produceEpochMark } from "./produceEpochMarker";

/**
 * Produce a minimal child block from a given parent block.
 * - Recomputes parent by hashing the parent's header w/o seal.
 * - Increments the slot.
 * - TODO handle placeholders.
 */
export function produceBlock(parentBlock: Block, extrinsicsData: ExtrinsicData): Block {
  const parentHash = generateBlockHash(parentBlock); // 1) Compute parent hash (w/o seal)
  const newSlot = parentBlock.header.slot + 1; // 2) Increment slot
  const epoch_mark = isEpochBoundary(newSlot) ? produceEpochMark() : null; // 3) Epoch marker
  console.log("epoch_mark", epoch_mark);
  const extrinsicHash = computeExtrinsicsMerkleRoot(extrinsicsData); // 4) Compute extrinsic hash


  // 2) Create new block with updated fields
  const childBlock: Block = {
    header: {
      parent: Uint8Array.from(Buffer.from(parentHash, "hex")),
      parent_state_root: parentBlock.header.parent_state_root, // or dummy for now
      extrinsic_hash: extrinsicHash,       // still a placehodler
      slot: newSlot,                       // increment
      epoch_mark: epoch_mark,               // TODOplaceholder
      tickets_mark: null,           // TODO placeholder
      offenders_mark: [],       // TODO placeholder
      author_index: 0,           // TODO placeholder
      entropy_source: new Uint8Array(),       // TODO placeholder
      seal: parentBlock.header.seal,                           // or null 
    },
    extrinsic: extrinsicsData,
    };


  return childBlock;
}

