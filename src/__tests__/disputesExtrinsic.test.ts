import { readFileSync } from 'fs';
import path from 'path';
import { Dispute } from '../block/types';
import { DisputeCodec } from '../block/types';

describe('DisputesCodec with DiscriminatorCodec (conformance tests)', () => {
  it('round-trip test with a mock Disputes object', () => {
    // 1) Create a sample Disputes object
    const mockDisputes: Dispute = {
      verdicts: [
        {
          target: new Uint8Array(32).fill(1),
          age: 2,
          votes: [
            {
              vote: true,
              index: 0,
              signature: new Uint8Array(64).fill(9),
            },
            {
              vote: false,
              index: 1,
              signature: new Uint8Array(64).fill(10),
            },
          ],
        },
      ],
      culprits: [
        {
          target: new Uint8Array(32).fill(3),
          key: new Uint8Array(32).fill(4),
          signature: new Uint8Array(64).fill(5),
        },
      ],
      faults: [
        {
          target: new Uint8Array(32).fill(6),
          vote: true,
          key: new Uint8Array(32).fill(7),
          signature: new Uint8Array(64).fill(8),
        },
      ],
    };

    // 2) Encode
    const encoded = DisputeCodec.enc(mockDisputes);

    // 3) Decode
    const decoded = DisputeCodec.dec(encoded);

    // 4) Compare - should be identical
    expect(decoded).toStrictEqual(mockDisputes);
  });

  it('matches conformance test vectors (disputes_extrinsic.bin / .json)', () => {
    // 1) Read the binary file
    const binPath = path.resolve(__dirname, '../data/disputes_extrinsic.bin');
    const encodedBin = new Uint8Array(readFileSync(binPath));

    // 2) Read the JSON file
    const jsonPath = path.resolve(__dirname, '../data/disputes_extrinsic.json');
    const rawJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    // 3) Build the expected "Disputes" object from JSON
    //    We assume the JSON looks like:
    //    {
    //      "verdicts": [ ... ],
    //      "culprits": [ ... ],
    //      "faults":   [ ... ]
    //    }
    const expected: Disputes = {
      verdicts: rawJson.verdicts.map((v: any) => ({
        target: Uint8Array.from(Buffer.from(v.target.slice(2), 'hex')),
        age: v.age,
        votes: v.votes.map((vt: any) => ({
          vote: vt.vote,
          index: vt.index,
          signature: Uint8Array.from(Buffer.from(vt.signature.slice(2), 'hex')),
        })),
      })),
      culprits: rawJson.culprits.map((c: any) => ({
        target: Uint8Array.from(Buffer.from(c.target.slice(2), 'hex')),
        key: Uint8Array.from(Buffer.from(c.key.slice(2), 'hex')),
        signature: Uint8Array.from(Buffer.from(c.signature.slice(2), 'hex')),
      })),
      faults: rawJson.faults.map((f: any) => ({
        target: Uint8Array.from(Buffer.from(f.target.slice(2), 'hex')),
        vote: f.vote,
        key: Uint8Array.from(Buffer.from(f.key.slice(2), 'hex')),
        signature: Uint8Array.from(Buffer.from(f.signature.slice(2), 'hex')),
      })),
    };

    // 4) Decode the binary with our new DisputesCodec
    const decoded = DisputeCodec.dec(encodedBin);

    // 5) Check it matches the expected object
    expect(decoded).toStrictEqual(expected);

    // 6) Re-encode and ensure it matches the original binary
    const reEncoded = DisputeCodec.enc(decoded);
    expect(reEncoded).toEqual(encodedBin);
  });
});
