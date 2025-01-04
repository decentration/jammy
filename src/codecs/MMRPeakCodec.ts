import { Codec, Encoder, Decoder } from "scale-ts";

export type MMRPeak = Uint8Array | null;

/**
 * MMRPeakCodec:
 *  - Writes 1 byte: 0x00 => null, 0x01 => next 32 bytes is the peak.
 */

export const MMRPeakCodec: Codec<MMRPeak> = (() => {
  const encode = (peak: MMRPeak): Uint8Array => {
    if (!peak || peak.length !== 32) {
      throw new Error(
        `MMRPeakCodec: peak must be exactly 32 bytes. Got length=${peak?.length ?? 'undefined'}`
      );
    }
    return peak;
  };

  const decode = (data: ArrayBuffer | Uint8Array | string): MMRPeak => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 32) {
      throw new Error(
        `MMRPeakCodec: not enough data. Expected >=32 bytes, got ${uint8.length}.`
      );
    }
    return uint8.slice(0, 32); 
  };

  const codec = [encode, decode] as Codec<MMRPeak>;
  codec.enc = encode;
  codec.dec = decode;
  return codec;
})();