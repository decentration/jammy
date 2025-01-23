export * from './decodeWithBytesUsed';



/**
 * Concatenate multiple Uint8Array buffers into one.
 */
export function concatAll(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((acc, arr) => acc + arr.length, 0);
    const out = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
      out.set(arr, offset);
      offset += arr.length;
    }
    return out;
  }
  
  /**
   * Convert an ArrayBuffer, string, or Uint8Array into a Uint8Array.
   */
  export function toUint8Array(data: ArrayBuffer | Uint8Array | string): Uint8Array {
    if (data instanceof Uint8Array) {
      return data;
    }
    if (typeof data === "string") {
      // Encode string as UTF-8
      return new TextEncoder().encode(data);
    }
    // Otherwise it's an ArrayBuffer
    return new Uint8Array(data);
  }
  

  /**
 * Convert a hex string (with or without "0x" prefix) into a Uint8Array.
 *
 * @example
 *   hexStringToBytes("0xdeadbeef") => Uint8Array([0xde, 0xad, 0xbe, 0xef])
 *   hexStringToBytes("deadbeef")   => Uint8Array([0xde, 0xad, 0xbe, 0xef])
 *
 * @throws Error if the string length is not even (after removing "0x" if present).
 */
export function hexStringToBytes(hexStr: string): Uint8Array {
    // Strip any leading "0x"
    const normalized = hexStr.startsWith("0x") ? hexStr.slice(2) : hexStr;
  
    // Must have an even number of hex digits
    if (normalized.length % 2 !== 0) {
      throw new Error(`hexStringToBytes: invalid hex (length must be even): ${hexStr}`);
    }
  
    // Convert two hex digits into one byte
    const out = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < out.length; i++) {
      const byteStr = normalized.substring(i * 2, i * 2 + 2);
      out[i] = parseInt(byteStr, 16);
    }
  
    return out;
  }
  

  /**
 * Recursively find "0x..." strings in an object or array 
 * and convert them to Uint8Array using hexStringToBytes
 */
export function convertHexFieldsToBytes(obj: any): void {
  if (Array.isArray(obj)) {
    obj.forEach(convertHexFieldsToBytes);
  } else if (obj && typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (typeof val === "string" && val.startsWith("0x")) {
        // convert
        obj[key] = hexStringToBytes(val);
      } else {
        // recurse
        convertHexFieldsToBytes(val);
      }
    }
  }
  return obj;
}


export function toBytes(input: string | Uint8Array): Uint8Array {
  // 1) If already a Uint8Array, return it
  if (input instanceof Uint8Array) {
    return input;
  }

  // 2) If it’s a hex string, strip "0x" if present
  //    and convert to bytes
  let hexStr = input.toLowerCase(); 
  if (hexStr.startsWith("0x")) {
    hexStr = hexStr.slice(2);
  }
  if (hexStr.length % 2 !== 0) {
    throw new Error(`toBytes: invalid hex string (odd length): ${input}`);
  }
  const out = new Uint8Array(hexStr.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hexStr.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}