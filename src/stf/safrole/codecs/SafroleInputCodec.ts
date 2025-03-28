import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { TicketEnvelopeCodec } from "./TicketEnvelopeCodec";
import { TicketEnvelope, SafroleInput } from "../types";
import { Codec, u32 } from "scale-ts";
import { concatAll, toUint8Array } from "../../../codecs/utils";

const TicketsExtrinsicCodec: Codec<TicketEnvelope[]> = DiscriminatorCodec(TicketEnvelopeCodec);

export const SafroleInputCodec: Codec<SafroleInput> = [
  // ENCODER
  (input: SafroleInput): Uint8Array => {
    // slot => u32
    const encSlot = u32.enc(input.slot);

    // entropy => 32 bytes 
    if (input.entropy.length !== 32) {
      throw new Error(`SafroleInputCodec: entropy must be 32 bytes`);
    }

    // extrinsic => array of TicketEnvelope
    const encExtrinsic = TicketsExtrinsicCodec.enc(input.extrinsic);

    return concatAll(encSlot, input.entropy, encExtrinsic);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): SafroleInput => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    // 1) slot => 4 bytes
    if (offset + 4 > uint8.length) {
      throw new Error(`SafroleInputCodec: insufficient data for slot`);
    }
    const slot = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    // 2) entropy => 32 bytes
    if (offset + 32 > uint8.length) {
      throw new Error(`SafroleInputCodec: insufficient data for entropy`);
    }
    const entropy = uint8.slice(offset, offset + 32);
    offset += 32;

    // 3) extrinsic => decode with TicketsExtrinsicCodec
    const slice = uint8.slice(offset);
    const { value: extrinsic, bytesUsed } = decodeWithBytesUsed(TicketsExtrinsicCodec, slice);
    offset += bytesUsed;

    console.log("SafroleInputCodec: dec", offset, bytesUsed);

    return { slot, entropy, extrinsic };
  },
] as unknown as Codec<SafroleInput>;

SafroleInputCodec.enc = SafroleInputCodec[0];
SafroleInputCodec.dec = SafroleInputCodec[1];
