// src/stf/assurances/codecs/OutputCodec.ts

import { Codec } from "scale-ts";
import { Output, OkData, ErrorCode } from "../../../types";
import { OkDataCodec } from "./OkDataCodec";

/**
 * OutputCodec:
 * Encodes/decodes the Output type.
 * Variants:
 * - { err: ErrorCode } => [0x01, ErrorCode]
 * - { ok: OkData } => [0x02, ...OkData]
 */
export const OutputCodec: Codec<Output> = [
  // ENCODER
  (out: Output): Uint8Array => {

    if (out === null) {
      return new Uint8Array([0x00]); 
    }

    if ("err" in out) {
      const errCode = out.err as ErrorCode;
      if (errCode < 0 || errCode > 0xff) {
        throw new Error(`OutputCodec.enc: invalid err code ${errCode}`);
      }
      return new Uint8Array([0x01, errCode & 0xff]);
    }

    if ("ok" in out) {
      const prefix = new Uint8Array([0x02]);
      const encodedOk = OkDataCodec.enc(out.ok as OkData);
      const outBuf = new Uint8Array(prefix.length + encodedOk.length);
      outBuf.set(prefix, 0);
      outBuf.set(encodedOk, prefix.length);
      return outBuf;
    }

    throw new Error("OutputCodec.enc: unrecognized variant in Output");
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
      throw new Error("OutputCodec.dec: no data to decode");
    }

    const tag = uint8[0];
    if (tag === 0x01) {
      if (uint8.length < 2) {
        throw new Error("OutputCodec.dec: insufficient data for 'err' variant");
      }
      const errCode = uint8[1];
      return { err: errCode as ErrorCode };
    } else if (tag === 0x02) {
      const slice = uint8.slice(1);
      const okData = OkDataCodec.dec(slice);
      return { ok: okData };
    }

    throw new Error(`OutputCodec.dec: invalid tag byte 0x${tag.toString(16)}`);
  },
] as Codec<Output>;

OutputCodec.enc = OutputCodec[0];
OutputCodec.dec = OutputCodec[1];