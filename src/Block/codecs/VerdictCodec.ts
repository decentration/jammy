import { Codec } from 'scale-ts';
import { Vote, VoteCodec, Verdict } from '../types';
import { SetCodec } from '../../codecs';



const VERDICT_TARGET_SIZE = 32;
const VERDICT_AGE_SIZE = 4;
const VOTE_SIZE = 67;

export const VerdictCodec: Codec<Verdict> = [
  // enc
  (verdict: Verdict) => {
    // 1) target: 32 bytes
    if (verdict.target.length !== VERDICT_TARGET_SIZE) {
      throw new Error(`VerdictCodec enc: target must be 32 bytes`);
    }

    // 2) age: 4 bytes
    const ageBuf = new Uint8Array(4);
    const dv = new DataView(ageBuf.buffer);
    dv.setUint32(0, verdict.age, true);

    // 3) votes... rely on index increments on decode.
    const encodedVotes = verdict.votes.map((v) => VoteCodec.enc(v));
    const votesTotalLen = encodedVotes.reduce((acc, e) => acc + e.length, 0);
    console.log('votesTotalLen:', votesTotalLen);
    
    if (votesTotalLen % VOTE_SIZE !== 0) {
      console.error(`Votes total length mismatch: ${votesTotalLen}, Expected: ${VOTE_SIZE}`);
    }
    
    // total out
    const out = new Uint8Array(VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE + votesTotalLen);

    // copy target
    out.set(verdict.target, 0);
    // copy age
    out.set(ageBuf, VERDICT_TARGET_SIZE);

    // copy votes
    let offset = VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE;
    for (const ev of encodedVotes) {
      console.log('ev:', ev);
      out.set(ev, offset);
      offset += ev.length;
    }

    return out;
  },

  // dec
  (data: ArrayBuffer) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE) {
      throw new Error(`VerdictCodec dec: not enough bytes for target + age`);
    }

    // 1) read target(32)
    const target = uint8.slice(0, VERDICT_TARGET_SIZE);

    // 2) read age(4)
    const ageBuf = uint8.slice(VERDICT_TARGET_SIZE, VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE);
    const dv = new DataView(ageBuf.buffer, ageBuf.byteOffset, ageBuf.byteLength);
    const age = dv.getUint32(0, true);

    // 3) read votes until out-of-data or next index != current index+1
    const votesData = uint8.slice(VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE);

    const votes: Vote[] = [];
    let offset = 0;
    let expectedIndex = 0;

    while (true) {
      if (offset + VOTE_SIZE > votesData.length) {
        // no more full votes => break
        break;
      }
      // decode potential vote
      const slice = votesData.slice(offset, offset + VOTE_SIZE);
      const v = VoteCodec.dec(slice);

      // check if v.index == expectedIndex
      if (v.index !== expectedIndex) {
        // not the next index => this is the start of the next verdict or next field
        // so we do not consume it here
        break;
      }

      // accept this vote
      votes.push(v);
      offset += VOTE_SIZE;
      expectedIndex++;
    }

    return { target, age, votes };
  },
] as unknown as Codec<Verdict>;

VerdictCodec.enc = VerdictCodec[0];
VerdictCodec.dec = VerdictCodec[1];
