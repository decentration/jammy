import { Codec } from "scale-ts";
import { decodeWithBytesUsed } from "../../../codecs";
import { concatAll, deepConvertHexToBytes, toBytes, toUint8Array } from "../../../codecs/utils";
import { u32 } from "scale-ts";
import { PreimagesInput } from "../types";
import { PreimagesExtrinsicCodec } from "./PreimageCodec";
import { cons } from "fp-ts/lib/ReadonlyNonEmptyArray";


export const PreimagesInputCodec: Codec<PreimagesInput> = [
  // ENCODER
  (inp: PreimagesInput): Uint8Array => {
  
    const encExt = PreimagesExtrinsicCodec.enc(inp.preimages);
    const slotEnc = u32.enc(inp.slot);

    return concatAll(encExt, slotEnc);
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
