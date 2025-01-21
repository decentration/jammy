// __tests__/block/serializeBlock.test.ts
import { serializeBlock, generateBlockHash } from "../../block/app/serializeBlock";
import { Block } from "../../types/types";

describe("serializeBlock tests", () => {
  it("serializes a block with and without seal", () => {
    const sampleBlock: Block = {
      header: {
        parent: Uint8Array.from([0x01, 0x02, 0x03]),
        parent_state_root: Uint8Array.from([0x04, 0x05, 0x06]),
        extrinsic_hash: Uint8Array.from([0x07, 0x08, 0x09]),
        slot: 42,
        epoch_mark: null,
        tickets_mark: null,
        offenders_mark: [],
        author_index: 3,
        // Must be exactly 96 bytes:
        entropy_source: new Uint8Array(96).fill(0xaa),
        seal: new Uint8Array(96).fill(0xbb),
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

    // 1) Serialize (with seal)
    const fullSerialized = serializeBlock(sampleBlock, false);
    expect(fullSerialized).toBeInstanceOf(Uint8Array);
    expect(fullSerialized.length).toBeGreaterThan(0);

    // 2) Serialize unsigned (without seal)
    const unsignedSerialized = serializeBlock(sampleBlock, true);
    expect(unsignedSerialized).toBeInstanceOf(Uint8Array);
    // Expect the unsigned version to be shorter than the full one because we removed the 96-byte seal.
    expect(unsignedSerialized.length).toBeLessThan(fullSerialized.length);

    // 3) Hash the block (unsigned)
    const blockHash = generateBlockHash(sampleBlock);
    console.log("Block hash (unsigned):", blockHash);
    expect(typeof blockHash).toBe("string");
    console.log("Block hash length (unsigned):", blockHash.length);
    expect(blockHash.length).toBe(64); // 32 bytes in hex without 0x
  });

  it("handles no seal gracefully", () => {
    const blockNoSeal: Block = {
      header: {
        parent: new Uint8Array(),
        parent_state_root: new Uint8Array(),
        extrinsic_hash: new Uint8Array(),
        slot: 0,
        epoch_mark: null,
        tickets_mark: null,
        offenders_mark: [],
        author_index: 0,
        entropy_source: new Uint8Array(),
        seal: null, 
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

    const fullSerialized = serializeBlock(blockNoSeal, false);
    expect(fullSerialized).toBeInstanceOf(Uint8Array);

    const unsignedSerialized = serializeBlock(blockNoSeal, true);
    expect(unsignedSerialized).toEqual(fullSerialized);
  });
});
