import { Block, ExtrinsicData } from "../types/types";
import { generateBlockHash } from "./serializeBlock";
import { computeExtrinsicsMerkleRoot } from "./ExtrinsicData/computeExtrinsicsMerkleRoot";

/**
 * Produce a minimal child block from a given parent block.
 * - Recomputes parent by hashing the parent's header w/o seal.
 * - Increments the slot.
 * - TODO handle placeholders.
 */
export function produceBlock(parentBlock: Block, extrinsicsData: ExtrinsicData): Block {
  // 1) Compute parent hash (w/o seal)
  const parentHash = generateBlockHash(parentBlock);

  console.log("Parent hash:", parentHash);

  // 2) Create new block with updated fields
  const childBlock: Block = {
    header: {
      parent: Uint8Array.from(Buffer.from(parentHash, "hex")),
      parent_state_root: parentBlock.header.parent_state_root, // or dummy for now
      extrinsic_hash: computeExtrinsicsMerkleRoot(extrinsicsData),       // still a placehodler
      slot: parentBlock.header.slot + 1,                       // increment
      epoch_mark: null,               // TODOplaceholder
      tickets_mark: null,           // TODO placeholder
      offenders_mark: [],       // TODO placeholder
      author_index: 0,           // TODO placeholder
      entropy_source: new Uint8Array(),       // TODO placeholder
      seal: parentBlock.header.seal,                           // or null 
    },
    extrinsic: {
        tickets: [],
        preimages: [],
        guarantees: [],
        assurances: [],
        disputes: {
          verdicts: [],
          culprits: [],
          faults: [],
        },
      },
    };


  return childBlock;
}

