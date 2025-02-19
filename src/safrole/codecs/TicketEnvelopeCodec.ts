import { Codec } from "scale-ts";
import { TicketEnvelope } from "../types";
import { toUint8Array, concatAll } from "../../codecs/utils";

export const TicketEnvelopeCodec: Codec<TicketEnvelope> = [
  // ENCODER
  (env: TicketEnvelope): Uint8Array => {
    // attempt => 1 byte
    // signature => 784 bytes
    const attemptBuf = new Uint8Array([env.attempt & 0xff]);

    if (env.signature.length !== 784) {
      throw new Error(`TicketEnvelopeCodec: signature must be 784 bytes (example)`);
    }

    return concatAll(attemptBuf, env.signature);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): TicketEnvelope => {
    const uint8 = toUint8Array(data);

    if (uint8.length < 785) {
      throw new Error(`TicketEnvelopeCodec: not enough data. Need 785 bytes, got ${uint8.length}`);
    }

    let offset = 0;

    const attempt = uint8[offset];
    offset += 1;

    const signature = uint8.slice(offset, offset + 784);
    offset += 784;

    if (offset < uint8.length) {
      console.warn(
        `TicketEnvelopeCodec: leftover bytes after reading envelope: offset=${offset}, total=${uint8.length}`
      );
    }

    return { attempt, signature };
  },
] as unknown as Codec<TicketEnvelope>;

TicketEnvelopeCodec.enc = TicketEnvelopeCodec[0];
TicketEnvelopeCodec.dec = TicketEnvelopeCodec[1];

