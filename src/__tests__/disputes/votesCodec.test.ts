import { readFileSync } from 'fs';
import path from 'path';
import { Vote } from '../../types/types';
import { VoteCodec } from '../../types/types'; // The one with `SetCodec(VoteCodec, 67)`
import { SetCodec } from '../../codecs';

describe('VotesCodec (set encoding) tests', () => {
  it('encodes/decodes a set of votes from JSON with no length prefix', () => {
    // 1) load the JSON snippet
    const jsonPath = path.resolve(__dirname, '../../data/disputes/votes.json');
    const votesJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    // 2) Convert JSON to Vote[]
    const votes: Vote[] = votesJson.map((v: any) => ({
      vote: v.vote,
      index: v.index,
      signature: Uint8Array.from(Buffer.from(v.signature.slice(2), 'hex')),
    }));

    const VotesCodec = SetCodec(VoteCodec, 67); // 1 + 2 + 64

    // 3) Encode with VotesCodec
    const encoded = VotesCodec.enc(votes);

    // 4) Decode
    const decoded = VotesCodec.dec(encoded);

    // 5) Check equality
    expect(decoded).toStrictEqual(votes);

    // 6) Hex dump
    // console.log('VotesCodec hex (no prefix):', Buffer.from(encoded).toString('hex'));
  });
});
