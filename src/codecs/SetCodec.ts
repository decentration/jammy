import { Codec, Encoder, Decoder } from "scale-ts";

/**
 * SetCodec:
 * Encodes/decodes a set (or array) of items with no length prefix,
 * where each item is a fixed-size structure.
 *
 * @param itemCodec - The codec for a single item.
 * @param itemSize  - The fixed size (in bytes) for each item in the set.
 * @returns A scale-ts Codec for T[], storing items in strict order with no prefix.
 */
export function SetCodec<T>(itemCodec: Codec<T>, itemSize: number): Codec<T[]> {
  const encode: Encoder<T[]> = (items: T[]): Uint8Array => {
    // Encode each item with itemCodec, then concatenate.
    const encodedItems = items.map((item) => itemCodec.enc(item));
    const totalSize = encodedItems.reduce((acc, buf) => acc + buf.length, 0);

    const out = new Uint8Array(totalSize);
    let offset = 0;
    for (const buf of encodedItems) {
      out.set(buf, offset);
      offset += buf.length;
    }

    return out;
  };

  const decode: Decoder<T[]> = (data: Uint8Array | ArrayBuffer | string): T[] => {
    const uint8Data =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

        // if (uint8Data.length % itemSize !== 0) {
        //     console.error('SetCodec Error: Data:', uint8Data);
        //     throw new Error(
        //         `SetCodec decode: buffer size ${uint8Data.length} is not a multiple of itemSize=${itemSize}`
        //     );
        // }

    const itemCount = uint8Data.length / itemSize;
    const items: T[] = [];

    for (let i = 0; i < itemCount; i++) {
        // console.log('SetCodec uint8Data:', itemCount, items, Buffer.from(uint8Data).toString('hex'));
        const slice = uint8Data.slice(i * itemSize, (i + 1) * itemSize);
      
        if (!(slice instanceof Uint8Array)) {
          throw new Error(`SetCodec: Expected Uint8Array, got ${typeof slice}`);
        }
        console.log(`SetCodec: Decoding slice ${i + 1}/${itemCount}:`, Buffer.from(slice).toString('hex'));

        const item = itemCodec.dec(slice);
        items.push(item);
      }
      console.log('SetCodec:', items);
    return items;
  };

  // Combine into scale-ts Codec shape: [encode, decode] & { enc, dec }
  const codec = [encode, decode] as Codec<T[]>;
  codec.enc = encode;
  codec.dec = decode;
  return codec;
}
