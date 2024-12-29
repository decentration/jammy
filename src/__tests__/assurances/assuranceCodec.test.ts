import { readFileSync } from 'fs';
import path from 'path';
import { AssuranceCodec } from '../../block/types';
import { Assurance } from '../../block/types';
import { DiscriminatorCodec } from '../../codecs';

const AssuranceDiscriminatorCodec = DiscriminatorCodec(AssuranceCodec);

describe('Decoding assurances_extrinsic (protocol doc approach)', () => {
  const binPath = path.resolve(__dirname, '../../data/assurances/assurances_extrinsic.bin');
  const jsonPath = path.resolve(__dirname, '../../data/assurances/assurances_extrinsic.json');

  it('should decode the file as a sequence of assurances, with 0x02 prefix for length=2', () => {
    // 1) read binary
    const encoded = new Uint8Array(readFileSync(binPath));

    // 2) decode
    let decoded: Assurance[];
    try {
      decoded = AssuranceDiscriminatorCodec.dec(encoded);
    } catch (err) {
      console.error('Decoding failed:', err);
      throw err;
    }

    // 3) read JSON for expected
    const rawJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    const expected = rawJson.map((obj: any) => ({
      anchor: Uint8Array.from(Buffer.from(obj.anchor.slice(2), 'hex')),
      bitfield: Uint8Array.from(Buffer.from(obj.bitfield.slice(2), 'hex')),
      validator_index: obj.validator_index,
      signature: Uint8Array.from(Buffer.from(obj.signature.slice(2), 'hex')),
    }));

    expect(decoded).toStrictEqual(expected);
  });
});
