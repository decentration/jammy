import { computeExtrinsicsMerkleRoot } from "../../block/merkle/computeExtrinsicsMerkleRoot";
import { ExtrinsicData } from "../../types/types";
import { sha256 } from "@noble/hashes/sha256";

describe("Merkle root computation for extrinsics", () => {
  it("computes the Merkle root for empty extrinsics", () => {
    const emptyExtrinsics: ExtrinsicData = {
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

    const root = computeExtrinsicsMerkleRoot(emptyExtrinsics);
    const expectedRoot = sha256(new Uint8Array());
    console.log("Root:", root);
    console.log("Expected root:", expectedRoot);
    expect(root).toEqual(expectedRoot);
  });

  // test for single extrinsic
  it("computes the Merkle root for non-empty extrinsics", () => {
    const extrinsics: ExtrinsicData = {
      tickets: [
        { attempt: 0, signature: new Uint8Array([0xaa, 0xbb, 0xcc]) },
      ],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: {
        verdicts: [],
        culprits: [],
        faults: [],
      },
    };

    const root = computeExtrinsicsMerkleRoot(extrinsics);

    // Manually compute the expected hash
    const ticketHash = sha256(new Uint8Array([0xaa, 0xbb, 0xcc])); // Ticket serialization
    const expectedRoot = ticketHash; // Single leaf == root

    expect(root).toEqual(expectedRoot);
  });

  // test for multiple extrinsics
  it("computes the Merkle root for multiple extrinsics", () => {
    const extrinsics: ExtrinsicData = {
      tickets: [
        { attempt: 0, signature: new Uint8Array([0xaa]) },
        { attempt: 1, signature: new Uint8Array([0xbb]) },
      ],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: {
        verdicts: [],
        culprits: [],
        faults: [],
      },
    };

    const root = computeExtrinsicsMerkleRoot(extrinsics);

    // Compute expected root manually
    const hash1 = sha256(new Uint8Array([0xaa]));
    const hash2 = sha256(new Uint8Array([0xbb]));
    const combinedHash = sha256(new Uint8Array([...hash1, ...hash2]));

    expect(root).toEqual(combinedHash);
  });

  // test for different extrinsic types
  it("changes the Merkle root when the type of extrinsic changes", () => {
    const extrinsics1: ExtrinsicData = {
      tickets: [{ attempt: 0, signature: new Uint8Array([0xaa]) }],
      preimages: [],
      guarantees: [],
      assurances: [],
      disputes: { verdicts: [], culprits: [], faults: [] },
    };
  
    const extrinsics2: ExtrinsicData = {
      tickets: [],
      preimages: [{ requester: 0, blob: new Uint8Array([0xaa]) }],
      guarantees: [],
      assurances: [],
      disputes: { verdicts: [], culprits: [], faults: [] },
    };
  
    const root1 = computeExtrinsicsMerkleRoot(extrinsics1);
    const root2 = computeExtrinsicsMerkleRoot(extrinsics2);
  
    expect(Buffer.from(root1).toString("hex")).not.toBe(Buffer.from(root2).toString("hex"));
  });

  

});
