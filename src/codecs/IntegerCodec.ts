/**
 * encodeProtocolInt:
 * - Encodes a number into a variable-length integer format.
 * - C.5 and C.6 from the GP. 
 */
export function encodeProtocolInt(x: number | bigint | null | undefined): Uint8Array {

  if (x == null || x == undefined) {
    x = 0;
  }

  let val = BigInt(x);

  if (val < 0n) {
    throw new Error(`encodeProtocolInt: cannot encode negative value ${val}`);
  }

  // Zero => single byte 0x00
  if (val === 0n) {
    return Uint8Array.of(0);
  }

  // 1) <= 127 (7 bits) => 1-byte
  if (val <= 127n) return Uint8Array.of(Number(val));


  // 2) <= 16383 (14 bits) => 2-byte
  if (val <= 16383n) {
    // LSB in second byte
    const low8  = Number(val & 0xFFn);
    const high6 = Number((val >> 8n) & 0x3Fn);
    const byte0 = 0b10000000 | high6; // 0b10xxxxxx
    const byte1 = low8;
    return new Uint8Array([byte0, byte1]);
  }

  // 3) <= 2_097_151 (21 bits) => 3-byte
  if (val <= 2_097_151n) { 
    const low8  = Number(val & 0xFFn);
    const mid8  = Number((val >> 8n) & 0xFFn);
    const high5 = Number((val >> 16n) & 0x1Fn);
    const byte0 = 0b11000000 | high5; // 0b110xxxxx
    return new Uint8Array([byte0, low8, mid8]);
  }

  // 4) <= 268_435_455 (28 bits) => 4-byte
  if (val <= 268_435_455n) { 
    const low8  = Number(val & 0xFFn);
    const mid8  = Number((val >> 8n) & 0xFFn);
    const high8 = Number((val >> 16n) & 0xFFn);
    const top4  = Number((val >> 24n) & 0x0Fn);
    const byte0 = 0b11100000 | top4;  // 0b1110xxxx
    return new Uint8Array([byte0, low8, mid8, high8]);
  }

  // 5) generic => 5-byte to 9-byte classes
  // determine l so that 2^7l <= val < 2^7(l+1) (l ∈ {4,…,8})
  let l = 4;
    while (l < 8 && val >= 1n << BigInt(7 * (l + 1))) l++;
  
    const q = val >> (8n * BigInt(l));                // ⌊x / 2⁸ˡ⌋
    const header = 256 - (1 << (8 - l)) + Number(q);       // spec C.6
  
    const out = new Uint8Array(1 + l);
    out[0] = header;
    let tmp = val;
    for (let i = 0; i < l; i++) {
      out[1 + i] = Number(tmp & 0xffn);
      tmp >>= 8n;
    }
    return out;
  }

  



// For decode:
export function decodeProtocolInt(data: Uint8Array): { value: number; bytesRead: number } {
  if (data.length === 0) {
    throw new Error("decodeProtocolInt: no data to decode");
  }

  const b0 = data[0];

  // 1) Single-byte
  if ((b0 & 0b10000000) === 0) {
    // top bit = 0 => single byte
    // it's guaranteed < 128
    return { value: b0, bytesRead: 1 };
  }

  // 2) 2-byte (0b10xxxxxx)
  if ((b0 & 0b11000000) === 0b10000000) {
    if (data.length < 2) {
      throw new Error("decodeProtocolInt: need 2 bytes");
    }
    const b1 = data[1];
    const high6 = BigInt(b0 & 0x3F);
    const low8  = BigInt(b1);
    const val = (high6 << 8n) | low8;
    return convertToNumber(val, 2);
  }

  // 3) 3-byte (0b110xxxxx)
  if ((b0 & 0b11100000) === 0b11000000) {
    if (data.length < 3) {
      throw new Error("decodeProtocolInt: need 3 bytes");
    }
    const b1 = data[1];
    const b2 = data[2];
    const high5 = BigInt(b0 & 0x1F);
    const mid8  = BigInt(b2);
    const low8  = BigInt(b1);
    const val = (high5 << 16n) | (mid8 << 8n) | low8;
    return convertToNumber(val, 3);
  }

  // 4) 4-byte (0b1110xxxx)
  if ((b0 & 0b11110000) === 0b11100000) {
    if (data.length < 4) {
      throw new Error("decodeProtocolInt: need 4 bytes");
    }
    const b1 = data[1];
    const b2 = data[2];
    const b3 = data[3];
    const top4 = BigInt(b0 & 0x0f);
    const l8   = BigInt(b1);
    const m8   = BigInt(b2);
    const h8   = BigInt(b3);
    const val = (top4 << 24n) | (h8 << 16n) | (m8 << 8n) | l8;
    return convertToNumber(val, 4);
  }

  // 5) 5..8 byte modes:
  if (b0 === 0xf0) {
    if (data.length < 6) {
      throw new Error("decodeProtocolInt: need 6 bytes for 5-byte mode");
    }
    const val = readNByteLittleEndian(data, 1, 5);
    return convertToNumber(val, 6);
  }

  if (b0 === 0xf1) {
    if (data.length < 7) {
      throw new Error("decodeProtocolInt: need 7 bytes for 6-byte mode");
    }
    const val = readNByteLittleEndian(data, 1, 6);
    return convertToNumber(val, 7);
  }

  if (b0 === 0xf2) {
    if (data.length < 8) {
      throw new Error("decodeProtocolInt: need 8 bytes for 7-byte mode");
    }
    const val = readNByteLittleEndian(data, 1, 7);
    return convertToNumber(val, 8);
  }

  if (b0 === 0xf3) {
    if (data.length < 9) {
      throw new Error("decodeProtocolInt: need 9 bytes for 8-byte mode");
    }
    const val = readNByteLittleEndian(data, 1, 8);
    return convertToNumber(val, 9);
  }

  throw new Error(`decodeProtocolInt: unknown prefix 0x${b0.toString(16)}`);
}

/**
 * readNByteLittleEndian:
 * Reads length bytes from data offset, interpreting them as
 * little endian integer, returns BigInt.
 */
function readNByteLittleEndian(data: Uint8Array, offset: number, length: number): bigint {
  let val = 0n;
  for (let i = 0; i < length; i++) {
    val |= BigInt(data[offset + i]) << (8n * BigInt(i));
  }
  return val;
}

/**
 * convertToNumber: cast a BigInt to number if it's <= 2^53-1
 */
function convertToNumber(val: bigint, bytesRead: number): { value: number; bytesRead: number } {
  if (val > Number.MAX_SAFE_INTEGER) {
    throw new Error(`decodeProtocolInt: value ${val.toString()} exceeds safe integer range`);
  }
  return { value: Number(val), bytesRead };
}


