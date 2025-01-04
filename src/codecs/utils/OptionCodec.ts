import { Codec, Encoder, Decoder } from "scale-ts";

/**
 * OptionCodec:
 *   - Encodes/decodes `T | null` values with a single tag byte:
 *     0x00 => null
 *     0x01 => followed by the encoded T
 */
export function OptionCodec<T>(inner: Codec<T>): Codec<T | null> {
  const encode: Encoder<T | null> = (value: T | null): Uint8Array => {
    if (value === null) {
      // Entire option is None
      return new Uint8Array([0x00]);
    }
    // Some => 0x01 + encode the inner value
    const encodedInner = inner.enc(value);
    const out = new Uint8Array(1 + encodedInner.length);
    out[0] = 0x01;
    out.set(encodedInner, 1);
    return out;
  };

  const decode: Decoder<T | null> = (data: ArrayBuffer | Uint8Array | string): T | null => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (!uint8.length) {
      throw new Error(`OptionCodec: no data to decode`);
    }

    const tag = uint8[0];
    if (tag === 0x00) {
      return null;
    } else if (tag === 0x01) {
      const slice = uint8.slice(1);
      return inner.dec(slice);
    }
    throw new Error(`OptionCodec: invalid tag 0x${tag.toString(16)}`);
  };

  const codec = [encode, decode] as Codec<T | null>;
  codec.enc = encode;
  codec.dec = decode;
  return codec;
}
