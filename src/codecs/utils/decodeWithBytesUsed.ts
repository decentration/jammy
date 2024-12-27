import { Codec } from "scale-ts";

/**
 * decodeWithBytesUsed: 
 *   A helper that calls codec.dec(...) and then 
 *   measures how many bytes that value consumed 
 *   by re‑encoding it.
 */
export function decodeWithBytesUsed<T>(
    codec: Codec<T>,
    data: Uint8Array
  ): { value: T; bytesUsed: number } {

    // 1) Decode
    const value = codec.dec(data)
    // 2) Re-encode to measure how many bytes were consumed
    const reencoded = codec.enc(value)
    const bytesUsed = reencoded.length

    return { value, bytesUsed }
  }



