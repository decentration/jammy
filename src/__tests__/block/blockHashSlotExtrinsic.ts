import { ExtrinsicDataCodec, validateBlock, produceBlock } from "../../block";
import { computeExtrinsicsMerkleRoot } from "../../block/ExtrinsicData/computeExtrinsicsMerkleRoot";
import { Block, ExtrinsicData } from "../../types/types";
import { toHexToggle } from "../../utils";
import { generateBlockHash } from "../../block/serializeBlock";
import { sha256 } from "@noble/hashes/sha256";

// Make a simple parent block
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
      faults: [],
    },
  },
};

// Minimal extrinsic data for testing
const extrinsicData: ExtrinsicData = {
  tickets: [],
  preimages: [],
  guarantees: [],
  assurances: [],
  disputes: {
    verdicts: [],
    culprits: [],
    faults: [],
  },
};

describe("Block production and validation", () => {
  it("produces a new block with an incremented slot, correct parent-hash, and computed extrinsic hash", () => {
    const childBlock = produceBlock(parentBlock, extrinsicData);

    // Check the slot increment
    expect(childBlock.header.slot).toBe(parentBlock.header.slot + 1);

    // Check the parent-hash
    const expectedParentHash = generateBlockHash(parentBlock);
    const actualParentHash = toHexToggle(childBlock.header.parent);

    expect(actualParentHash).toBe(expectedParentHash);

    // Check the extrinsic hash
    const computedExtrinsicHash = computeExtrinsicsMerkleRoot(extrinsicData);
    expect(Buffer.from(childBlock.header.extrinsic_hash).toString("hex")).toBe(
      Buffer.from(computedExtrinsicHash).toString("hex")
    );

    // Validate the block
    expect(() => validateBlock(childBlock, parentBlock)).not.toThrow();
  });

  it("throws if the slot doesn't increment", () => {
    const badChildBlock: Block = {
      ...parentBlock,
      header: {
        ...parentBlock.header,
        slot: parentBlock.header.slot, // No increment
        parent: Uint8Array.from(Buffer.from(generateBlockHash(parentBlock), "hex")),
      },
    };

    expect(() => validateBlock(badChildBlock, parentBlock)).toThrow(/slot mismatch/);
  });

  it("throws if the parent-hash is incorrect", () => {
    const childBlock = produceBlock(parentBlock, extrinsicData);

    // Tamper with the parent hash
    childBlock.header.parent = new Uint8Array([0xff, 0xff]);

    expect(() => validateBlock(childBlock, parentBlock)).toThrow(/parent-hash mismatch/);
  });
});

describe("Extrinsics hash computation", () => {
  it("correctly computes the Merkle root for empty extrinsics", () => {
    const computedHash = computeExtrinsicsMerkleRoot(extrinsicData);

    const emptyExtrinsic = {
        tickets: [],
        preimages: [],
        guarantees: [],
        assurances: [],
        disputes: {
            verdicts: [],
            culprits: [],
            faults: [],
        },
    }
    
    // Compute hash manually for comparison (should match the placeholder logic)
    const serializedExtrinsics = ExtrinsicDataCodec.enc(emptyExtrinsic);
    const expectedHash = Buffer.from(sha256(serializedExtrinsics));

    expect(Buffer.from(computedHash).toString("hex")).toBe(expectedHash.toString("hex"));
  });

  it("correctly computes the Merkle root for non-empty extrinsics", () => {
    const nonEmptyExtrinsics: ExtrinsicData = {
      ...extrinsicData,
      tickets: [{ attempt: 0, signature: new Uint8Array([0xaa, 0xbb, 0xcc]) }],
    };

    const computedHash = computeExtrinsicsMerkleRoot(nonEmptyExtrinsics);

    // Encode the non-empty extrinsics and manually compute the hash
    const serializedExtrinsics = ExtrinsicDataCodec.enc(nonEmptyExtrinsics);
    const expectedHash = Buffer.from(sha256(serializedExtrinsics));

    expect(Buffer.from(computedHash).toString("hex")).toBe(expectedHash.toString("hex"));
  });
});
