import { produceBlock } from "../../block/app/produceBlock";
import { Block } from "../../types/types";

describe("Epoch marker integration tests", () => {
  it("should produce epoch_mark = null on normal slot increment", () => {
    const parent: Block = {
      header: {
        parent: new Uint8Array(32).fill(0x00),
        parent_state_root: new Uint8Array(32).fill(0x01),
        extrinsic_hash: new Uint8Array(32).fill(0x02),
        slot: 5, // Not near epoch boundary (because EPOCH_LENGTH=12)
        epoch_mark: null,
        tickets_mark: null,
        offenders_mark: [],
        author_index: 0,
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

    const child = produceBlock(parent, parent.extrinsic);
    expect(child.header.epoch_mark).toBeNull();
  });

  it("should produce a new epoch_mark if slot crosses epoch boundary (slot=12, 24, etc.)", () => {
    const parent: Block = {
      header: {
        parent: new Uint8Array(32),
        parent_state_root: new Uint8Array(32),
        extrinsic_hash: new Uint8Array(32),
        slot: 11, // next slot boundary
        epoch_mark: null,
        tickets_mark: null,
        offenders_mark: [],
        author_index: 0,
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

    const child = produceBlock(parent, parent.extrinsic);
    expect(child.header.epoch_mark).not.toBeNull();
    const epochMark = child.header.epoch_mark!;
    expect(epochMark.entropy.every((x) => x === 0xaa)).toBe(true);
    expect(epochMark.tickets_entropy.every((x) => x === 0xbb)).toBe(true);
    expect(epochMark.validators.length).toBe(6);
  });
});
