import { Codec, Encoder, Decoder } from "scale-ts";

export type MMRPeak = Uint8Array | null;

/**
 * MMRPeakCodec:
 * 1 byte tag:
 *   0x00 => null
 *   0x01 => next 32 bytes is the peak
 */
export const MMRPeakCodec: Codec<MMRPeak> = (() => {
  // ------------------
  // 1) ENCODER
  // ------------------
  const encode: Encoder<MMRPeak> = (peak: MMRPeak): Uint8Array => {
    if (peak === null) {
      // Tag=0 => no further bytes
      return new Uint8Array([0]);
    } else {
      // Tag=1 => 32 bytes must follow
      if (peak.length !== 32) {
        throw new Error(
          `MMRPeakCodec: got a non-null peak but length != 32 (got=${peak.length}).`
        );
      }
      const out = new Uint8Array(1 + 32);
      out[0] = 1; // the discriminator
      out.set(peak, 1);
      return out;
    }
  };

  // ------------------
  // 2) DECODER
  // ------------------
  const decode: Decoder<MMRPeak> = (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 1) {
      throw new Error(`MMRPeakCodec: not enough data for 1‐byte tag`);
    }
    const tag = uint8[0];
    if (tag === 0) {
      return null;
    } else if (tag === 1) {
      if (uint8.length < 1 + 32) {
        throw new Error(
          `MMRPeakCodec: not enough data for 32 bytes, total=${uint8.length}`
        );
      }
      const peak = uint8.slice(1, 33);
      return peak;
    } else {
      throw new Error(`MMRPeakCodec: invalid tag=${tag}, expected 0|1`);
    }
  };

  const codec = [encode, decode] as Codec<MMRPeak>;
  codec.enc = encode;
  codec.dec = decode;
  return codec;
})();
