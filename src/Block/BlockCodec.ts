import { Codec } from "scale-ts";
import { HeaderCodec } from "../codecs/HeaderCodec";
import { ExtrinsicDataCodec } from "./ExtrinsicData/ExtrinsicData";
import { Block } from "../types/types";
import { decodeWithBytesUsed } from "../codecs";


export const BlockCodec: Codec<Block> = [
  // 1) ENCODER
  (block: Block): Uint8Array => {
    // a) Encode the header
    const encHeader = HeaderCodec.enc(block.header);

    // b) Encode the extrinsic
    const encExtrinsic = ExtrinsicDataCodec.enc(block.extrinsic);

    // c) Concatenate both
    const totalSize = encHeader.length + encExtrinsic.length;
    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encHeader, offset);
    offset += encHeader.length;
    out.set(encExtrinsic, offset);

    return out;
  },

  // 2) DECODER
  (input: ArrayBuffer | Uint8Array | string): Block => {
    // Convert input to Uint8Array
    const uint8 =
      input instanceof Uint8Array
        ? input
        : typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);

    let offset = 0;

    // a) Decode the header
    const { value: header, bytesUsed: headerBytesUsed } = decodeWithBytesUsed(
      HeaderCodec,
      uint8.slice(offset)
    );
    offset += headerBytesUsed;

    // b) Decode the extrinsic
    const { value: extrinsic, bytesUsed: extrinsicBytesUsed } = decodeWithBytesUsed(
      ExtrinsicDataCodec,
      uint8.slice(offset)
    );
    offset += extrinsicBytesUsed;

    // Ensure all bytes are consumed
    if (offset !== uint8.length) {
      throw new Error(
        `BlockCodec: Unexpected extra data after decoding. Expected ${offset} bytes, got ${uint8.length}`
      );
    }

    return { header, extrinsic };
  },
] as unknown as Codec<Block>;

BlockCodec.enc = BlockCodec[0];
BlockCodec.dec = BlockCodec[1];
