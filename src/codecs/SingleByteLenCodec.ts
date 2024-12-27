import { Codec, createCodec } from 'scale-ts'

/**
 * SingleByteLenBytes: 
 *   - 1 byte for the length (max 255).
 *   - then the raw bytes themselves.
 */
export const SingleByteLenCodec: Codec<Uint8Array> = createCodec(
  // 1) Encoder
  (value: Uint8Array) => {
// console.log('SingleByteLenCodec value:', value);
    // if value is zero length, return a single byte of zero
    if (value.length === 0) {
      return new Uint8Array([0])
    }
    if (value.length > 255) {
      throw new Error(`SingleByteLenBytes: cannot encode length > 255`)
    }

    const out = new Uint8Array(1 + value.length)
    out[0] = value.length
    out.set(value, 1)
    return out
  },
  // 2) Decoder
  (data: Uint8Array | ArrayBuffer | string) => {
    const uint8 = 
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data)


        // if the length byte is zero, return an empty array
    if (uint8.length === 1 && uint8[0] === 0) {
        return new Uint8Array(0)
        }
    if (uint8.length < 1) {
      throw new Error(`SingleByteLenBytes: no length byte found`)
    }

    const len = uint8[0]
    if (uint8.length < 1 + len) {
      throw new Error(
        `SingleByteLenBytes: not enough bytes; declared len=${len}, actual=${uint8.length - 1}`
      )
    }

    return uint8.slice(1, 1 + len)
  }
)
