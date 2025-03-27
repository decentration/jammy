import { Codec } from "scale-ts";
import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { VarLenBytesCodec } from "../../../codecs/VarLenBytesCodec"; 
import { toUint8Array, concatAll } from "../../../codecs/utils";
import { u32 } from "scale-ts";
import { Preimage } from "../types";

export const PreimageCodec: Codec<Preimage> = [
  // ENCODER
  (p: Preimage): Uint8Array => {
    const requesterEnc = u32.enc(p.requester);
    const blobEnc = VarLenBytesCodec.enc(p.blob);

    return concatAll(requesterEnc, blobEnc);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Preimage => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    if (offset + 4 > uint8.length) {
      throw new Error(`PreimageCodec: insufficient data for requester`);
    }
    const requester = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    const slice = uint8.slice(offset);
    const { value: blob, bytesUsed } = decodeWithBytesUsed(VarLenBytesCodec, slice);
    offset += bytesUsed;

    return { requester, blob };
  },
] as unknown as Codec<Preimage>;

PreimageCodec.enc = PreimageCodec[0];
PreimageCodec.dec = PreimageCodec[1];

export const PreimagesExtrinsicCodec: Codec<Preimage[]> = DiscriminatorCodec<Preimage>(PreimageCodec);
