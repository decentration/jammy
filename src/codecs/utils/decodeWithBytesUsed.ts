import { Codec } from "scale-ts";
import { convertToReadableFormat } from "../../utils";

/**
 * decodeWithBytesUsed: 
 *   A helper that calls codec.dec(...) and then 
 *   measures how many bytes that value consumed 
 *   by re‑encoding it.
 * 
 *  TEMPORARY helper as its performance is O(2n)
 *  wheras manual slicing is is O(1)
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
    // console.log("bytesUsed: ", bytesUsed, convertToReadableFormat(value));
    return { value, bytesUsed }
  }



