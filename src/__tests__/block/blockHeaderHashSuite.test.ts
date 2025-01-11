import { validateBlock, produceBlock } from "../../block";
import { DisputeCodec } from "../../codecs";
import { computeExtrinsicsMerkleRoot } from "../../block/merkle/computeExtrinsicsMerkleRoot";
import { Block, ExtrinsicData, TicketCodec} from "../../types/types";
import { toHexToggle } from "../../utils";
import { generateBlockHash } from "../../block/serializeBlock";
import { sha256 } from "@noble/hashes/sha256";
import { DiscriminatorCodec } from "../../codecs/DiscriminatorCodec";
import { wellBalancedMerkle } from "../../block/merkle/wellBalancedMerkle";

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

    // 1) slot increment
    expect(childBlock.header.slot).toBe(parentBlock.header.slot + 1);

    // 2) parent-hash
    const expectedParentHash = generateBlockHash(parentBlock);
    const actualParentHash = toHexToggle(childBlock.header.parent);
    expect(actualParentHash).toBe(expectedParentHash);

    // 3) extrinsic hash
    const computedExtrinsicHash = computeExtrinsicsMerkleRoot(extrinsicData);
    expect(Buffer.from(childBlock.header.extrinsic_hash).toString("hex")).toBe(
      Buffer.from(computedExtrinsicHash).toString("hex")
    );

    // 4) Validate
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

  // it("computes the Merkle root for empty extrinsics (with one disputes leaf)", () => {
  //   const emptyExtrinsics: ExtrinsicData = {
  //     tickets: [],
  //     preimages: [],
  //     guarantees: [],
  //     assurances: [],
  //     disputes: { verdicts: [], culprits: [], faults: [] },
  //   };

  //   // Manually replicate the same logic as computeExtrinsicsMerkleRoot:
  //   //  1) We do not encode "tickets/preimages/..." since they are empty. => no leaf added.
  //   //  2) We always encode "disputes" => one leaf.
  //   const disputeBytes = DisputeCodec.enc(emptyExtrinsics.disputes);
  //   console.log("Dispute bytes:", disputeBytes);
  //   const disputeLeaf = sha256(disputeBytes);

  //   // The Merkle tree sees exactly 1 leaf => final root = that leaf
  //   const expectedRoot = disputeLeaf;

  //   // Compare with function
  //   const actualRoot = computeExtrinsicsMerkleRoot(emptyExtrinsics);
  //   expect(Buffer.from(actualRoot).toString("hex")).toBe(
  //     Buffer.from(expectedRoot).toString("hex")
  //   );
  // });

  it("correctly computes the Merkle root for non-empty extrinsics", () => {
    const nonEmptyExtrinsics: ExtrinsicData = {
      tickets: [{ attempt: 0, signature: new Uint8Array([0xaa, 0xbb, 0xcc]) }],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: { verdicts: [], culprits: [], faults: [] },
    };
  
    // Step 1: Gather leaves
    const ticketCodec = DiscriminatorCodec(TicketCodec);
    const leafHashes: Uint8Array[] = [];
  
    // Add tickets
    nonEmptyExtrinsics.tickets.forEach(ticket => {
      const ticketBytes = ticketCodec.enc([ticket]);
      leafHashes.push(sha256(ticketBytes));
    });
  
    // Add disputes
    const disputeBytes = DisputeCodec.enc(nonEmptyExtrinsics.disputes);
    const disputeLeaf = sha256(disputeBytes);
    leafHashes.push(disputeLeaf);
  
    // Step 2: Compute expected Merkle root
    const expectedRoot = wellBalancedMerkle(leafHashes);
  
    // Step 3: Compute actual Merkle root
    const actualRoot = computeExtrinsicsMerkleRoot(nonEmptyExtrinsics);
  
    // Step 4: Compare results
    expect(Buffer.from(actualRoot).toString("hex")).toBe(
      Buffer.from(expectedRoot).toString("hex")
    );
  });
  

  it("computes the Merkle root for totally empty extrinsics => 32 zero bytes", () => {
    const emptyExtrinsics: ExtrinsicData = {
      tickets: [],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: { verdicts: [], culprits: [], faults: [] },
    };
  
    // 1) We expect a zero-hash if truly empty (check protocol rule)
    const expectedRoot = new Uint8Array(32);
  
    // 2) compute
    const actualRoot = computeExtrinsicsMerkleRoot(emptyExtrinsics);
  
    // 3) compare
    expect(Buffer.from(actualRoot).toString("hex"))
      .toBe(Buffer.from(expectedRoot).toString("hex"));
  });
  
  
});
