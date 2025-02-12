/**
 * encodeProtocolInt:
 * - Encodes a number into a variable-length integer format.
 * - C.5 from the GP. 
 */
export function encodeProtocolInt(x: number): Uint8Array {
  if (x < 0) {
    throw new Error(`encodeProtocolInt: cannot encode negative value ${x}`);
  }

  if (x === 0) return Uint8Array.of(0);

  if (x <= 127) {
    // Single-byte encoding (fits in 7 bits)
    return Uint8Array.of(x);
  } else if (x <= 16383) {
    // 2 byte encoding 14-bit numbers, little-endian
    const low8 = x & 0xFF;
    const high6 = (x >> 8) & 0x3F;

    // First byte: 0b10xxxxxx where xxxxxx are the highest bits of x
    const byte0 = 0b10110000 | high6;  // 1011 + upper 6 bits
    const byte1 = low8;  // LSB

    return new Uint8Array([byte0, byte1]);
  } else if (x <= 2_097_151) {
    // Three byte encoding 21-bit numbers
    const low8 = x & 0xFF;  // lowest 8 bits
    const mid8 = (x >> 8) & 0xFF;  // middle 8 bits
    const high5 = (x >> 16) & 0x1F;  // highest 5 bits

    // First byte: 0b110xxxxx (indicating 3-byte mode)
    const byte0 = 0b11000000 | high5;
    
    return new Uint8Array([byte0, low8, mid8]);  // LSB first
  } else if (x <= 268_435_455) {
    // Four byte encoding (28-bit numbers)
    const low8 = x & 0xFF;
    const mid8 = (x >> 8) & 0xFF;
    const high8 = (x >> 16) & 0xFF;
    const top4 = (x >> 24) & 0x0F;

    // First byte: 0b1110xxxx indicating 4-byte mode
    const byte0 = 0b11100000 | top4;
    
    return new Uint8Array([byte0, low8, mid8, high8]);  // Fully little-endian
  } else {
    throw new Error(`encodeProtocolInt: not implemented for x >= 268435455`);
  }
}


// For decode:
export function decodeProtocolInt(data: Uint8Array): { value: number; bytesRead: number } {
  if (data.length === 0) {
    throw new Error("decodeProtocolInt: no data to decode");
  }

  const b0 = data[0];

  // Single-byte (x <= 127)
  if ((b0 & 0b10000000) === 0) {
    return { value: b0, bytesRead: 1 };
  }
  
  // Two-byte case  (x <= 16383 => 14-bit)
  else if ((b0 & 0b11000000) === 0b10000000) {
    if (data.length < 2) {
      throw new Error("decodeProtocolInt (2-byte): need more bytes");
    }
    const b1 = data[1];
    
    // LSB is b1, upper 6 bits are in (b0 & 0x3F).
    const high6 = (b0 & 0x3F);
    const low8 = b1;
    
    // So x = (high6 << 8) + low8
    const value = (high6 << 8) | low8;

    return { value, bytesRead: 2 };
  }
  
  // Three-byte case (x <= 2,097,151 => 21 bits)
  else if ((b0 & 0b11100000) === 0b11000000) {
    if (data.length < 3) {
      throw new Error("decodeProtocolInt (3-byte): need more bytes");
    }
    const b1 = data[1];
    const b2 = data[2];
    
    // top 5 bits => (b0 & 0x1F)
    // next 8 bits => b2
    // lowest 8 bits => b1
    // x = ( (b0 & 0x1F) << 16 ) + (b2 << 8 ) + b1
    const high5 = (b0 & 0x1F);
    const mid8  = b2;
    const low8  = b1;
    const value = (high5 << 16) | (mid8 << 8) | low8;
    
    return { value, bytesRead: 3 };
  }
  
  // Four-byte case (x <= 268,435,455 => 28 bits)
  else if ((b0 & 0b11110000) === 0b11100000) {
    if (data.length < 4) {
      throw new Error("decodeProtocolInt (4-byte): need more bytes");
    }
    const b1 = data[1];
    const b2 = data[2];
    const b3 = data[3];
    
    // top 4 bits => (b0 & 0x0F)
    // next 8 bits => b3
    // next 8 bits => b2
    // lowest 8 bits => b1
    // x = ( (b0 & 0x0F)<<24 ) + ( b3<<16 ) + ( b2<<8 ) + b1
    const high4 = (b0 & 0x0F);
    const h8    = b3;
    const m8    = b2;
    const l8    = b1;
    const value = (high4 << 24) | (h8 << 16) | (m8 << 8) | l8;
    
    return { value, bytesRead: 4 };
  }
  
  else {
    throw new Error("decodeProtocolInt: unsupported format");
  }
}
