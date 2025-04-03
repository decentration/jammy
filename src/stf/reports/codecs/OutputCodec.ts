import { Codec } from "scale-ts";
import { Output, OkData, ErrorCode } from "../types";
import { OkDataCodec } from "./OkDataCodec";
import { REPORTS_ERROR_CODES } from "../types"; 

// 1) map 
const errorCodeToByte = new Map<ErrorCode, number>();
REPORTS_ERROR_CODES.forEach((code, idx) => errorCodeToByte.set(code, idx));

function byteToErrorCode(b: number): ErrorCode {
  if (b < 0 || b >= REPORTS_ERROR_CODES.length) {
    throw new Error(`OutputCodec: invalid error code byte=${b}`);
  }
  return REPORTS_ERROR_CODES[b];
}

/**
 * OutputCodec:
 *   null => [0x00]
 *   { err: ErrorCode } => [0x01, <byteIndex>]
 *   { ok: OkData }     => [0x02, <OkDataCodec>...]
 */
export const OutputCodec: Codec<Output> = [
  // ENCODER
  (out: Output): Uint8Array => {

    if (out === null) {
      // 1) null => [0x02]
      return new Uint8Array([0x02]);
    }
    
    if ("ok" in out) {
      // 3) ok variant => [0x00, <OkDataCodec>...]
      const prefix = new Uint8Array([0x00]);
      const encodedOk = OkDataCodec.enc(out.ok as OkData);
      const outBuf = new Uint8Array(prefix.length + encodedOk.length);
      outBuf.set(prefix, 0);
      outBuf.set(encodedOk, 1);
      return outBuf;
    }
    
    if ("err" in out) {
      // 2) err variant => [0x01, <errIndex>]
      const errStr = out.err as ErrorCode;
      const errIndex = errorCodeToByte.get(errStr);
      if (errIndex === undefined) {
        throw new Error(`OutputCodec.enc: unknown error code='${errStr}'`);
      }
      return new Uint8Array([0x01, errIndex]);
    }




    throw new Error("OutputCodec.enc: unrecognized variant");
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Output => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length === 0) {
      throw new Error("OutputCodec.dec: no data");
    }
    const tag = uint8[0];

    if (tag === 0x00) {
      // ok => [0x02, ...OkData...]
      const slice = uint8.slice(1);
      const okData = OkDataCodec.dec(slice);
      return { ok: okData };
    }

      if (tag === 0x01) {
      // err => [0x01, errIndex]
      if (uint8.length < 2) {
        throw new Error("OutputCodec.dec: insufficient data for 'err'");
      }
      const errIndex = uint8[1];
      const errStr = byteToErrorCode(errIndex);
      return { err: errStr };
    } 
    
   

    throw new Error(`OutputCodec.dec: invalid tag byte=0x${tag.toString(16)}`);
  }
] as unknown as Codec<Output>;

OutputCodec.enc = OutputCodec[0];
OutputCodec.dec = OutputCodec[1];
