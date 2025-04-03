import { Codec } from "scale-ts";
import { DisputesOutput, ErrorCode, OkData } from "../types";
import { OkDataCodec } from "./OkDataCodec"; 
import { DISPUTES_ERROR_CODES } from "../types";

/**
 * OutputCodec:
 *   - null => single byte [0x00]
 *   - { err: ErrorCode } => [0x01, <errIndex>]
 *   - { ok: OkData } => [0x02, <OkDataCodec-encoded bytes>...]
 */
export const OutputCodec: Codec<DisputesOutput> = [
  // ENCODER
  (out: DisputesOutput): Uint8Array => {
    if (out === null) {
      throw new Error("OutputCodec.enc: null variant not supported. Shouuld either be Err or Ok");
    }

    if ("ok" in out) {
      // 3) ok => [0x00, OkDataCodec...]
      const prefix = new Uint8Array([0x00]);
      const encodedOk = OkDataCodec.enc(out.ok as OkData);
      const outBuf = new Uint8Array(prefix.length + encodedOk.length);
      outBuf.set(prefix, 0);
      outBuf.set(encodedOk, 1);
      return outBuf;
    }

    if ("err" in out) {
      // 2) err => [0x01, errorIndex]
      //    errorIndex is 1 byte from errorCodeToByte
      const errVal = out.err as ErrorCode;
      const errIndex = errorCodeToByte.get(errVal);
      // console.log("OutputCodec.enc: errVal=", errVal, "errIndex=", errIndex);
      if (errIndex === undefined) {
        throw new Error(`OutputCodec.enc: unknown ErrorCode='${errVal}'`);
      }
      return new Uint8Array([0x01, errIndex]);
    }
    
    throw new Error("OutputCodec.enc: unrecognized variant of DisputesOutput");
  },

  // DECODER
  (blob: ArrayBuffer | Uint8Array | string): DisputesOutput => {
    const uint8 =
      blob instanceof Uint8Array
        ? blob
        : typeof blob === "string"
        ? new TextEncoder().encode(blob)
        : new Uint8Array(blob);

    if (uint8.length === 0) {
      throw new Error("OutputCodec.dec: no data");
    }

    const tag = uint8[0];

    // if (tag === 0x00) {
    //   // null => [0x00]
    //   return null;

   if (tag === 0x00) {
    // ok => [0x00, <OkDataCodec>...]
    const okSlice = uint8.slice(1);
    const okData = OkDataCodec.dec(okSlice);
    return { ok: okData };
  } else if (tag === 0x01) {
      // err => [0x01, errIndex]
      if (uint8.length < 2) {
        throw new Error("OutputCodec.dec: insufficient data for 'err'");
      }
      const errIndex = uint8[1];
      const errVal = byteToErrorCode(errIndex);
      return { err: errVal };
    // } else if (tag === 0x02) {
    //   // ok => [0x02, <OkDataCodec>...]
    //   const okSlice = uint8.slice(1);
    //   const okData = OkDataCodec.dec(okSlice);
    //   return { ok: okData };
    // }
  }

    throw new Error(`OutputCodec.dec: invalid tag=0x${tag.toString(16)}`);
  },
] as unknown as Codec<DisputesOutput>;

OutputCodec.enc = OutputCodec[0];
OutputCodec.dec = OutputCodec[1];


// build map from string -> index
const errorCodeToByte = new Map<ErrorCode, number>();
DISPUTES_ERROR_CODES.forEach((code, i) => errorCodeToByte.set(code, i));

// reverse lookup 
function byteToErrorCode(b: number): ErrorCode {
  if (b < 0 || b >= DISPUTES_ERROR_CODES.length) {
    throw new Error(`OutputCodec: invalid error code byte=${b}`);
  }
  return DISPUTES_ERROR_CODES[b];
}