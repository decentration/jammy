import { Codec } from "scale-ts";
import { Vote, Verdict, VoteCodec } from "../types/types";
import {  VOTE_COUNT } from "../consts";

const VERDICT_TARGET_SIZE = 32;
const VERDICT_AGE_SIZE = 4;
const VOTE_SIZE = 67;

export const VerdictCodec: Codec<Verdict> = [
  // ENCODER
  (verdict: Verdict): Uint8Array => {
    if (verdict.target.length !== VERDICT_TARGET_SIZE) {
      throw new Error(`VerdictCodec enc: target must be 32 bytes`);
    }
    // Age => 4 bytes
    const ageBuf = new Uint8Array(VERDICT_AGE_SIZE);
    new DataView(ageBuf.buffer).setUint32(0, verdict.age, true);

    // Votes
    if (verdict.votes.length !== VOTE_COUNT) {
      throw new Error(
        `VerdictCodec enc: expected exactly ${VOTE_COUNT} votes, got ${verdict.votes.length}`
      );
    }
    const encodedVotes = verdict.votes.map((v) => VoteCodec.enc(v));
    const votesTotalLen = encodedVotes.reduce((acc, e) => acc + e.length, 0);

    const out = new Uint8Array(
      VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE + votesTotalLen
    );
    // 1) copy target
    out.set(verdict.target, 0);
    // 2) copy age
    out.set(ageBuf, VERDICT_TARGET_SIZE);
    // 3) copy votes
    let offset = VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE;
    for (const ev of encodedVotes) {
      out.set(ev, offset);
      offset += ev.length;
    }

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Verdict => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE) {
      throw new Error(`VerdictCodec dec: not enough bytes for target + age`);
    }
    // 1) read target(32)
    const target = uint8.slice(0, VERDICT_TARGET_SIZE);

    // 2) read age(4)
    const ageBuf = uint8.slice(VERDICT_TARGET_SIZE, VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE);
    const age = new DataView(ageBuf.buffer, ageBuf.byteOffset, 4).getUint32(0, true);

    // 3) read votes
    const votesData = uint8.slice(VERDICT_TARGET_SIZE + VERDICT_AGE_SIZE);
    const votes: Vote[] = [];
    const neededBytes = VOTE_COUNT * VOTE_SIZE;
    if (votesData.length < neededBytes) {
      throw new Error(
        `VerdictCodec dec: not enough data for ${VOTE_COUNT} votes (need ${neededBytes} bytes, got ${votesData.length})`
      );
    }

    let offset = 0;
    for (let i = 0; i < VOTE_COUNT; i++) {
      const slice = votesData.slice(offset, offset + VOTE_SIZE);
      const v = VoteCodec.dec(slice);
      votes.push(v);
      offset += VOTE_SIZE;
    }

    return { target, age, votes };
  },
] as unknown as Codec<Verdict>;

VerdictCodec.enc = VerdictCodec[0];
VerdictCodec.dec = VerdictCodec[1];
