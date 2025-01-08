import { produceBlock } from "../../block/produceBlock"
import { validateBlock } from "../../block/validateBlock";
import { Block } from "../../types/types";
import { toHexToggle } from "../../utils";
import { generateBlockHash } from "../../block/serializeBlock";


// Makesimple parent block
const parentBlock: Block = {
    header: {
      parent: new Uint8Array(32).fill(0xaa), 
      parent_state_root: new Uint8Array(32).fill(0xbb),
      extrinsic_hash: new Uint8Array(32).fill(0xcc),
      slot: 42,
      epoch_mark: null,
      tickets_mark: null,
      offenders_mark: [],
      author_index: 0,
      entropy_source: new Uint8Array(96).fill(0xdd),
      seal: Uint8Array.from(new Array(96).fill(0xee)),
    },
    extrinsic: {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: {
        verdicts: [],
        culprits: [],
        faults: []
      },
    },
};

  describe("Minimal parent-hash & slot checks", () => {
    it("produces a new block with an incremented slot and correct parent-hash", () => {
      const childBlock = produceBlock(parentBlock);
  
      // Check the slot increment
      expect(childBlock.header.slot).toBe(parentBlock.header.slot + 1);
  
      // Check the parent-hash
      const expectedParentHash = generateBlockHash(parentBlock);
      const actualParentHash = toHexToggle(childBlock.header.parent);
  
      expect(actualParentHash).toBe(expectedParentHash);
  
      // Validate the block
      expect(() => validateBlock(childBlock, parentBlock)).not.toThrow();
    });
  
    it("throws if the slot doesn't increment", () => {
      const badChildBlock: Block = {
        ...parentBlock,
        header: {
          ...parentBlock.header,
          slot: parentBlock.header.slot, // No increment
          parent: Uint8Array.from(Buffer.from(generateBlockHash(parentBlock), "hex")), // Remove 0x
        },
      };
  
      expect(() => validateBlock(badChildBlock, parentBlock)).toThrow(/slot mismatch/);
    });
  
    it("throws if the parent-hash is incorrect", () => {
      const childBlock = produceBlock(parentBlock);
  
      // Tamper with the parent hash
      childBlock.header.parent = new Uint8Array([0xff, 0xff]);
  
      expect(() => validateBlock(childBlock, parentBlock)).toThrow(/parent-hash mismatch/);
    });
  });
