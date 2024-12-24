import { readFileSync } from 'fs';
import path from 'path';
import { Vote } from '../../block/types';
import { VoteCodec } from '../../block/types'; 

describe('VoteCodec (encode/decode votes) tests', () => {
  it('encodes/decodes an array of votes (no length prefix) from JSON, then hex dumps', () => {
    // 1) Load the JSON snippet (the array of votes)
    const jsonPath = path.resolve(__dirname, '../../data/disputes/votes.json');
    const votesJson = JSON.parse(readFileSync(jsonPath, 'utf-8'));

    // 2) Convert JSON objects into Vote objects
    const votes: Vote[] = votesJson.map((obj: any) => ({
      vote: obj.vote,
      index: obj.index,
      signature: Uint8Array.from(Buffer.from(obj.signature.slice(2), 'hex')),
    }));

    // 3) Encode the array WITHOUT a length prefix.
    //    We individually encode each Vote, then concatenate.

    // We'll store all encoded items in a list
    const encodedItems: Uint8Array[] = votes.map((v) => VoteCodec.enc(v));

    // Now find total size and build a single Uint8Array
    const totalSize = encodedItems.reduce((acc, buf) => acc + buf.length, 0);
    const encoded = new Uint8Array(totalSize);

    let offset = 0;
    for (const item of encodedItems) {
      encoded.set(item, offset);
      offset += item.length;
    }

    // 4) Decode them back by slicing 67 bytes each (1+2+64) in a loop
    const decoded: Vote[] = [];
    offset = 0;
    const VOTE_SIZE = 67; // 1 byte for bool, 2 bytes for u16 index, 64 for signature

    for (let i = 0; i < votes.length; i++) {
      const slice = encoded.slice(offset, offset + VOTE_SIZE);
      const voteDecoded = VoteCodec.dec(slice);
      decoded.push(voteDecoded);
      offset += VOTE_SIZE;
    }

    // 5) Check round-trip equality
    expect(decoded).toStrictEqual(votes);

    // 6) Hex dump for debugging or conformance
    const hexDump = Buffer.from(encoded).toString('hex');
    console.log('Encoded votes (no prefix) hex dump:', hexDump);
  });
});
