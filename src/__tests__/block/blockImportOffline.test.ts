import { produceBlock, validateBlock, importBlock } from "../../block/app";
import { Block } from "../../types/types";
import { State } from "../../state/types"; 
import { BlockCodec } from "../../block/BlockCodec";
import path from 'path';
import fs from 'fs';
import { convertToReadableFormat, toHex } from "../../utils";

describe("Offline block import test with STF", () => {
  it("applies a ticket extrinsic to the in-memory state and updates gamma_a", () => {
    // 1) Create a minimal preState
    //    For M1, we are storing just enough fields for the STF.
    //    gamma_a = [] so we see if a new ticket is appended.
    const preState: State = {
      timeslotIndex: { index: 0 },
      gamma: {
        gamma_k: [],        // next-epoch keys
        gamma_z: new Uint8Array(32).fill(0x00), // 
        gamma_s: [],        // current epochs sealing keys
        gamma_a: [],        // ticket accumulator
      },
      // placeholders for other partitions:
      authorization: { required: [] },
      recentBlocks: { blockHashes: [] },
      services: { accounts: [] },
      entropyPool: { pool: "" },
      validatorQueue: { queue: [] },
      currentValidators: { validators: [] },
      archivedValidators: { archive: [] },
      coreReports: { reports: [] },
      coreQueue: { queue: [] },
      privilegedServices: { services: [] },
      judgements: { judgements: [] },
      validatorStatistics: { statistics: [] },
      workReports: { reports: [] },
      workPackages: { packages: [] },
    };

    // 2) Create a parent block (slot=0, empty extrinsic)
    const parentBlock: Block = {
      header: {
        parent: new Uint8Array(32).fill(0xaa),
        parent_state_root: new Uint8Array(32).fill(0xbb),
        extrinsic_hash: new Uint8Array(32).fill(0xcc),
        slot: 0,
        epoch_mark: {
            entropy: new Uint8Array(32).fill(0x11),
            tickets_entropy: new Uint8Array(32).fill(0x22),
            validators: [
              new Uint8Array(32).fill(0x33),
              new Uint8Array(32).fill(0x44),
              new Uint8Array(32).fill(0x55),
              new Uint8Array(32).fill(0x66),
              new Uint8Array(32).fill(0x77),
              new Uint8Array(32).fill(0x88),
            ],
        },
        // epoch_mark: null,
        tickets_mark: null,
        offenders_mark: [],
        author_index: 0,
        entropy_source: new Uint8Array(96).fill(0xdd),
        seal: new Uint8Array(96).fill(0xee),
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


    // 3) Construct the extrinsic data with a "ticket"

    const ringVrfSig784 = new Uint8Array(784).fill(0xaa);

    const ticketExtrinsic = {
      tickets: [
        { attempt: 0, signature: ringVrfSig784 },
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

    // 4) Produce child block with that extrinsic
    const childBlock = produceBlock(parentBlock, ticketExtrinsic);

    // 5) Encode the child block
    const encoded = BlockCodec.enc(childBlock);

    console.log("Encoded block:", toHex(encoded));


    // 6) Write the encoded block to a file
    const outDir = path.resolve(__dirname, "../output/block/blockImportOfflineTest");
    fs.mkdirSync(outDir, { recursive: true });

    fs.writeFileSync(
      path.join(outDir, "encodedBlock.bin"),
      Buffer.from(encoded)
    );
    fs.writeFileSync(
      path.join(outDir, "encodedBlock.txt"),
      toHex(encoded) 
    );

    // 7) Decode
    const decoded = BlockCodec.dec(encoded);

    // 8) Write debug files for decoded block
    fs.writeFileSync(
    path.join(outDir, "originalBlock.json"),
    JSON.stringify(convertToReadableFormat(childBlock), null, 2)
    );
    fs.writeFileSync(
    path.join(outDir, "decodedBlock.json"),
    JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 9) validation & STF (offline)
    //    a) Validate the block
    expect(() => validateBlock(decoded, parentBlock)).not.toThrow();

    //    b) Apply minimal STF logic: 
    //     For example, the STF merges ticket extrinsics into gamma_a.
    const postState = importBlock(preState, parentBlock, decoded);

    // 10) Check that postState includes our new ticket in gamma_a
    //    So gamma_a had 0 items, now should have 1.
    expect(postState.gamma.gamma_a.length).toBe(1);
    expect(postState.gamma.gamma_a[0]).toEqual(new Uint8Array(ringVrfSig784));
    expect(postState.timeslotIndex.index).toBe(1);
    // If we store the entire "ticket body" or just the signature, check that it's not empty, or matches the expected format.
    // For now, let's just see that we have something:
    const [ticketEntry] = postState.gamma.gamma_a;
    expect(ticketEntry).toBeDefined();

    // 11) Check that timeslotIndex incremented?
    expect(postState.timeslotIndex.index).toBe(1);
  });
});

