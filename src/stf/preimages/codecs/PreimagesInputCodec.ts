import { Codec } from "scale-ts";
import { decodeWithBytesUsed } from "../../../codecs";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { u32 } from "scale-ts";
import { PreimagesInput } from "../types";
import { PreimagesExtrinsicCodec } from "./PreimageCodec";


export const PreimagesInputCodec: Codec<PreimagesInput> = [
  // ENCODER
  (inp: PreimagesInput): Uint8Array => {
    const slotEnc = u32.enc(inp.slot);
    const extEnc = PreimagesExtrinsicCodec.enc(inp.preimages);
    return concatAll(extEnc, slotEnc);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): PreimagesInput => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    {
      const slice = uint8.slice(offset);
      const { value: preimages, bytesUsed } = decodeWithBytesUsed(PreimagesExtrinsicCodec, slice);
      offset += bytesUsed;
      var preimages_ = preimages;
    }

    if (offset + 4 > uint8.length) {
      throw new Error(`PreimagesInputCodec: insufficient data for slot`);
    }
    const slot = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    return { preimages: preimages_, slot };
  },
] as unknown as Codec<PreimagesInput>;

PreimagesInputCodec.enc = PreimagesInputCodec[0];
PreimagesInputCodec.dec = PreimagesInputCodec[1];
