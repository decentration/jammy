import { Codec } from "scale-ts";
import { SafroleOutput, OkData, ErrorCode, SAFROLE_ERROR_CODES } from "../types";
import { OkDataCodec } from "./OkDataCodec";

/**
 * SafroleOutputCodec:
 * Encodes/decodes the `SafroleOutput` type with this pattern:
 *
 *   If "ok" variant => first byte = 0x00, then encode OkData
 *   If "err" variant => first byte = 0x01, then one byte for ErrorCode
 *
 * Example Encodings:
 *   - { err: "bad_slot" } => 0x01 0x00
 *   - { ok: { epoch_mark: ..., tickets_mark: ...} } => 0x00 [OkData bytes]
 */
export const SafroleOutputCodec: Codec<SafroleOutput> = [
  // ENCODER
  (out: SafroleOutput): Uint8Array => {
    // If it's an "err"
    if ("err" in out) {
          const errStr = out.err as ErrorCode;
          const errByte = errorCodeToByte.get(errStr);
          if (errByte === undefined) {
            throw new Error(`OutputCodec.enc: unknown error code='${errStr}'`);
          }
          return new Uint8Array([0x01, errByte]);
        }

    // Otherwise must be "ok"
    // 0x00 => "ok" tag
    // then the OkData
    const prefix = new Uint8Array([0x00]);
    const encodedOk = OkDataCodec.enc(out.ok as OkData);

    const outBuf = new Uint8Array(prefix.length + encodedOk.length);
    outBuf.set(prefix, 0);
    outBuf.set(encodedOk, prefix.length);
    return outBuf;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): SafroleOutput => {
    console.log("SafroleOutputCodec.dec", data);

    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length === 0) {
      throw new Error("SafroleOutputCodec.dec: no data to decode");
    }

    const tag = uint8[0];
    console.log("SafroleOutputCodec.dec: uint8", tag, uint8);
    if (tag === 0x00) {
      // => "ok"
      // decode OkData from the remainder
      const slice = uint8.slice(1);
      const okData = OkDataCodec.dec(slice);
      return { ok: okData };
    } else if (tag === 0x01) {
      // => "err"
      if (uint8.length < 2) {
        throw new Error("SafroleOutputCodec.dec: insufficient data for 'err' variant");
      }
      const errByte = uint8[1];
      const errStr = byteToErrorCode(errByte);
      return { err: errStr };
    }

    throw new Error(`SafroleOutputCodec.dec: invalid tag byte ${tag}`);
  },
] as Codec<SafroleOutput>;

SafroleOutputCodec.enc = SafroleOutputCodec[0];
SafroleOutputCodec.dec = SafroleOutputCodec[1];

const errorCodeToByte = new Map<ErrorCode, number>();
SAFROLE_ERROR_CODES.forEach((code, i) => errorCodeToByte.set(code, i));

// reverse lookup 
function byteToErrorCode(b: number): ErrorCode {
  if (b < 0 || b >= SAFROLE_ERROR_CODES.length) {
    throw new Error(`OutputCodec: invalid error code byte=${b}`);
  }
  return SAFROLE_ERROR_CODES[b];
}