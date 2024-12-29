import { Codec, Encoder, Decoder } from "scale-ts"
import { encodeProtocolInt, decodeProtocolInt } from "./IntegerCodec"

/**
 * DiscriminatorCodec: Creates a compatible codec for a sequence of items,

 */
export function DiscriminatorCodec<T>(itemCodec: Codec<T>): Codec<T[]> {
  // 1) The encoder function
  const encode: Encoder<T[]> = (items: T[]): Uint8Array => {
    // Encode the length prefix
    const lengthBuf = encodeProtocolInt(items.length)

    // Encode each item
    const encodedItems = items.map((item) => itemCodec.enc(item))

    // Concatenate length prefix + each item
    const totalSize = lengthBuf.length + encodedItems.reduce((acc, buf) => acc + buf.length, 0)
    const out = new Uint8Array(totalSize)

    out.set(lengthBuf, 0)
    let offset = lengthBuf.length

    for (const buf of encodedItems) {
      out.set(buf, offset)
      offset += buf.length
    }
    // console.log('discriminator codec out:', Buffer.from(out).toString('hex'));
    return out
  }

  // 2) The decoder function
  const decode: Decoder<T[]> = (data: Uint8Array | ArrayBuffer | string): T[] => {
    // Convert string/ArrayBuffer to Uint8Array if necessary
    const uint8Data = data instanceof Uint8Array
      ? data
      : typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data)
console.log('discriminator codec in decoder:', Buffer.from(uint8Data).toString('hex'));
    // Decode the length prefix
    const { value: length, bytesRead } = decodeProtocolInt(uint8Data)
    if (length === 0) {
      return []
    }

    // Decode each item
    const items: T[] = []
    let offset = bytesRead
// console.log('discriminator codec in:', Buffer.from(uint8Data).toString('hex'));
    for (let i = 0; i < length; i++) {
      // Decode item from slice
      const item = itemCodec.dec(uint8Data.slice(offset))

      // To find how many bytes were consumed, we can re-encode the item
      // or if it's fixed-size, we know the length directly.
      const reencoded = itemCodec.enc(item)
      offset += reencoded.length

      if (offset > uint8Data.length) {
        throw new Error(`DiscriminatorCodec: out-of-bounds decoding item #${i}`)
      }

      items.push(item)
    }
    // console.log('codec items:', items);
    return items;
  }

  // 3) Combine them into the scale-ts Codec shape:
  //    an array `[encode, decode]` with enc/dec properties, all merged.
  const codec = [encode, decode] as unknown as Codec<T[]>
  codec.enc = encode
  codec.dec = decode
  return codec
}
