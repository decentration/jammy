import { Codec } from "scale-ts";
import { toUint8Array } from "../../../codecs/utils";
import { PREIMAGES_ERROR_CODES, ErrorCode, PreimagesOutput } from "../types";

export const PreimagesOutputCodec: Codec<PreimagesOutput> = [
  // ENCODER
  (out: PreimagesOutput): Uint8Array => {
    if ("err" in out) {

      const errByte = errorCodeToByte.get(out.err);
      if (errByte === undefined) {
        throw new Error(`PreimagesOutputCodec.enc: unknown error code='${out.err}'`);
      }
      return new Uint8Array([0x01, errByte]);
    }
    return new Uint8Array([0x00]);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): PreimagesOutput => {
    const uint8 = toUint8Array(data);
    if (uint8.length < 1) {
      throw new Error("PreimagesOutputCodec.dec: not enough data for tag");
    }
    const tag = uint8[0];
    if (tag === 0x00) {
      // => ok
      return { ok: null };
    } else if (tag === 0x01) {
      // => err
      if (uint8.length < 2) {
        throw new Error("PreimagesOutputCodec.dec: not enough data for error code");
      }
      const errByte = uint8[1];
      const err = byteToErrorCode(errByte);
      return { err };
    }
    throw new Error(`PreimagesOutputCodec.dec: invalid tag byte ${tag}`);
  },
] as unknown as Codec<PreimagesOutput>;

PreimagesOutputCodec.enc = PreimagesOutputCodec[0];
PreimagesOutputCodec.dec = PreimagesOutputCodec[1];


const errorCodeToByte = new Map<ErrorCode, number>();
PREIMAGES_ERROR_CODES.forEach((code, i) => errorCodeToByte.set(code, i));

function byteToErrorCode(b: number): ErrorCode {
  if (b < 0 || b >= PREIMAGES_ERROR_CODES.length) {
    throw new Error(`PreimagesOutputCodec: invalid error code byte=${b}`);
  }
  return PREIMAGES_ERROR_CODES[b];
}
