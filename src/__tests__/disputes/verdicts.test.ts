import { readFileSync } from 'fs';
import path from 'path';
import { Verdict } from '../../block/types'; 
import { VerdictCodec } from '../../block/codecs';
import { DiscriminatorCodec } from '../../codecs';

const VerdictsDiscriminatorCodec = DiscriminatorCodec(VerdictCodec);

describe('VerdictCodec with index-increment logic', () => {
  it('encodes/decodes multiple verdicts from JSON', () => {
    // 1) load JSON,
    const jsonPath = path.resolve(__dirname, '../../data/disputes/verdicts.json');
    const verdictsJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    // 2) convert to typed
    const verdicts: Verdict[] = verdictsJson.map((v: any) => ({
      target: Uint8Array.from(Buffer.from(v.target.slice(2), 'hex')),
      age: v.age,
      votes: v.votes.map((vt: any) => ({
        vote: vt.vote,
        index: vt.index,
        signature: Uint8Array.from(Buffer.from(vt.signature.slice(2), 'hex')),
      })),
    }));

    // 3) encode => # of verdicts + each verdict
    const encoded = VerdictsDiscriminatorCodec.enc(verdicts);

    // 4) decode
    const decoded = VerdictsDiscriminatorCodec.dec(encoded);

    // 5) compare
    expect(decoded).toStrictEqual(verdicts);

    console.log('Encoded verdicts with index-based votes detection:', Buffer.from(encoded).toString('hex'));
    // console.log('Decoded verdicts:', decoded);
  });
});
