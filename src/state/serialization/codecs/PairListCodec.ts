import { Codec } from "scale-ts";
import { concatAll } from "../../../codecs/utils";
import { DiscriminatorCodec } from "../../../codecs";

/**
 * Codec for a single pair of [K, V].
 */
function PairCodec<K, V>(k: Codec<K>, v: Codec<V>): Codec<[K, V]> {
  const codec = [
    // ENCODER
    ([key, val]: [K, V]): Uint8Array => concatAll(k.enc(key), v.enc(val)),

    // DECODER
    (data: Uint8Array | ArrayBuffer | string): [K, V] => {
      const bytes = data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);
      let offset = 0;

      const key = k.dec(bytes.slice(offset));
      offset += k.enc(key).length;

      const val = v.dec(bytes.slice(offset));
      offset += v.enc(val).length;

      return [key, val];
    },
  ] as unknown as Codec<[K, V]>;

  codec.enc = codec[0];
  codec.dec = codec[1];

  return codec;
}

/**
 * PairListCodec with DiscriminatorCodec.
 * Encodes a length-prefixed array of [K,V] pairs
 */
export function PairListCodec<K, V>(
  k: Codec<K>,
  v: Codec<V>,
  options?: { maxSize?: number; minSize?: number }
): Codec<[K, V][]> {
  const singlePairCodec = PairCodec(k, v);

  return DiscriminatorCodec(singlePairCodec, options);
}