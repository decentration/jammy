import { Bytes, Codec } from "scale-ts";
import { OpaqueHash } from "../../../types";
import { AccumulateOutput } from "../types";
import { decode } from "punycode";
import { decodeWithBytesUsed, toUint8Array } from "../../../codecs";


export const AccumulateOutputCodec: Codec<AccumulateOutput> = [
  // ENCODER
  (out: AccumulateOutput): Uint8Array => {
    if (out === null) {
      throw new Error("AccumulateOutputCodec.enc: null variant not supported. Shouuld either be Err or Ok");
    }
    if ("ok" in out) {
      // 3) ok variant => [0x00, ...]
      // the ok data is an OpaqueHash type which is a Uint8Array 32 bytes
      const prefix = new Uint8Array([0x00]);
      const encodedOk = Bytes(32).enc(out.ok as OpaqueHash);
      const outBuf = new Uint8Array(prefix.length + encodedOk.length);
      outBuf.set(prefix, 0);
      outBuf.set(encodedOk, 1);
      return outBuf;
    }    

    throw new Error("AccumulateOutputCodec.enc: unrecognized variant");
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AccumulateOutput => {
    const uint8 = toUint8Array(data);
    if (uint8.length === 0) {
      throw new Error("AccumulateOutputCodec.dec: no data");
    }

    // First byte is the tag
    const tag = uint8[0];
    const rest = uint8.slice(1);

    if (tag === 0x00) {
      // The “ok” variant => next 32 bytes is the opaque hash
      const { value: okHash, bytesUsed } = decodeWithBytesUsed(Bytes(32), rest);
      if (bytesUsed < 32) {
        throw new Error("AccumulateOutputCodec.dec: not enough bytes for ok hash");
      }
      return { ok: okHash };
    }

    throw new Error(`AccumulateOutputCodec.dec: invalid tag byte=0x${tag.toString(16)}`);
  }
] as unknown as Codec<AccumulateOutput>;

AccumulateOutputCodec.enc = AccumulateOutputCodec[0];
AccumulateOutputCodec.dec = AccumulateOutputCodec[1];