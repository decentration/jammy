import { Codec } from "scale-ts";
import { Output, OkData, ErrorCode, ASSURANCES_ERROR_CODES } from "../../../types";
import { OkDataCodec } from "./OkDataCodec";

/**
 * OutputCodec:
 * Encodes/decodes the Output type:
 *
 * Variants:
 *   - `{ err: ErrorCode }` => [0x01, <byteForErrorIndex>]
 *   - `{ ok: OkData }`     => [0x00, <encodedOkData>...]
 */
export const OutputCodec: Codec<Output> = [
  // ---------------------
  // ENCODER
  // ---------------------
  (out: Output): Uint8Array => {

    // console.log("OutputCodec out: ", out);
    // 1) null variant
    if (out === null) {
      throw new Error("OutputCodec.enc: null variant not supported. Shouuld either be Err or Ok");
    }

    // 2) Error variant => [0x01, <errIndex>]
    if ("err" in out) {
      const errStr = out.err as ErrorCode;
      const errByte = errorCodeToByte.get(errStr);
      if (errByte === undefined) {
        throw new Error(`OutputCodec.enc: unknown error code='${errStr}'`);
      }
      return new Uint8Array([0x01, errByte]);
    }

    // 3) OK variant => [0x00, <OkDataCodec>...]
    if ("ok" in out) {
      const prefix = new Uint8Array([0x00]);
      const encodedOk = OkDataCodec.enc(out.ok as OkData);
      const outBuf = new Uint8Array(prefix.length + encodedOk.length);
      outBuf.set(prefix, 0);
      outBuf.set(encodedOk, 1);
      return outBuf;
    }

    throw new Error("OutputCodec.enc: unrecognized variant in Output");
  },

  // ---------------------
  // DECODER
  // ---------------------
  (data: ArrayBuffer | Uint8Array | string): Output => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length === 0) {
      throw new Error("OutputCodec.dec: no data to decode");
    }

    // 1) The tag is the first byte
    const tag = uint8[0];

    // [0x00] => null
    if (tag === 0x02) {
      return null;
    }

    // [0x01, errByte] => error
    if (tag === 0x01) {
      if (uint8.length < 2) {
        throw new Error("OutputCodec.dec: insufficient data for 'err' variant");
      }
      const errByte = uint8[1];
      const errStr = byteToErrorCode(errByte);
      return { err: errStr };
    }

    // [0x02, ...OkData] => OK
    if (tag === 0x00) {
      const slice = uint8.slice(1);
      const okData = OkDataCodec.dec(slice);
      return { ok: okData };
    }

    throw new Error(`OutputCodec.dec: invalid tag byte 0x${tag.toString(16)}`);
  },
] as Codec<Output>;

OutputCodec.enc = OutputCodec[0];
OutputCodec.dec = OutputCodec[1];

// build map from string -> index
const errorCodeToByte = new Map<ErrorCode, number>();
ASSURANCES_ERROR_CODES.forEach((code, i) => errorCodeToByte.set(code, i));

// reverse lookup 
function byteToErrorCode(b: number): ErrorCode {
  if (b < 0 || b >= ASSURANCES_ERROR_CODES.length) {
    throw new Error(`OutputCodec: invalid error code byte=${b}`);
  }
  return ASSURANCES_ERROR_CODES[b];
}