import { readFileSync } from 'fs';
import * as path from 'path';
import { DiscriminatorCodec } from '../../codecs';
import { AssuranceCodec } from '../../types/types';
import { Assurance } from '../../types/types';

describe('DiscriminatorCodec(AssuranceCodec)', () => {
  const assuranceDiscriminatorCodec = DiscriminatorCodec(AssuranceCodec);
  
  // or:
  // const [encodeAssurances, decodeAssurances] = DiscriminatorCodec(AssuranceCodec);

  it('encodes and decodes a custom array of Assurance items (round-trip)', () => {
    // 1) Create some mock Assurance data
    const original: Assurance[] = [
      {
        anchor: new Uint8Array(32).fill(1),
        bitfield: new Uint8Array([0x01]),
        validator_index: 42,
        signature: new Uint8Array(64).fill(9),
      },
      {
        anchor: new Uint8Array(32).fill(2),
        bitfield: new Uint8Array([0x00]),
        validator_index: 99,
        signature: new Uint8Array(64).fill(10),
      },
    ];

    // 2) Encode
    const encoded = assuranceDiscriminatorCodec.enc(original);

    // 3) Decode
    const decoded = assuranceDiscriminatorCodec.dec(encoded);

    // 4) Verify round-trip success
    expect(decoded).toStrictEqual(original);
  });

  it('matches known conformance test vectors (binary + JSON)', () => {
    // 1) Load the known-good binary from test vectors
    const binPath = path.resolve(__dirname, '../../data/assurances/assurances_extrinsic.bin');
    const encodedBytes = new Uint8Array(readFileSync(binPath));

    // 2) Load the corresponding JSON
    const jsonPath = path.resolve(__dirname, '../../data/assurances/assurances_extrinsic.json');
    const rawJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    // 3) Construct the expected Assurance[] from the JSON
    const expected: Assurance[] = rawJson.map((obj: any) => ({
      anchor: Uint8Array.from(Buffer.from(obj.anchor.slice(2), 'hex')),
      bitfield: Uint8Array.from(Buffer.from(obj.bitfield.slice(2), 'hex')),
      validator_index: obj.validator_index,
      signature: Uint8Array.from(Buffer.from(obj.signature.slice(2), 'hex')),
    }));

    // 4) Decode the binary with our codec
    const decoded = assuranceDiscriminatorCodec.dec(encodedBytes);

    // 5) Check that decoding matches the JSON
    expect(decoded).toStrictEqual(expected);

    // 6) Re-encode the decoded items and verify it matches the original bytes
    const reEncoded = assuranceDiscriminatorCodec.enc(decoded);
    expect(reEncoded).toEqual(encodedBytes);
  });
});
