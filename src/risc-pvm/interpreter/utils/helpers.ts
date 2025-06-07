// Length helper stays same
export const immediateLength = (availableLength: number): number => Math.min(4, availableLength);
  
// Decode a 32 bit or smaller signed immediate
export const decodeImmediate = (bytes: Uint8Array): number => {
  const value = decodeSignedIntLE(bytes);
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("decodeImmediate: immediate value exceeds safe JS number range");
  return Number(value);
};
  
// Decode an offset relative to the current PC, using the immediate bytes
export const decodeOffset = (currentPc: number, bytes: Uint8Array): number => {
  const offsetValue = decodeImmediate(bytes); 
  return currentPc + offsetValue;
};

// Decodes a signed immediate <= 32 bits
export const decodeImmediate32 = (bytes: Uint8Array): number => {
  if (bytes.length < 1 || bytes.length > 4)
    throw new Error("decodeImmediate32: only supports 1–4 byte immediates");
  const result = decodeSignedIntLE(bytes);
  if (result < BigInt(Number.MIN_SAFE_INTEGER) || result > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("decodeImmediate32: immediate out of safe JS number range");
  return Number(result);
};
  
// Decodes a signed immediate <= 64 bits, returns big int
export function decodeImmediate64(bytes: Uint8Array): bigint {
  if (bytes.length !== 8) {
      throw new Error("decodeImmediate64 expects exactly 8 bytes");
  }
  let value = 0n;
  for (let i = 0; i < 8; i++) {
      value |= BigInt(bytes[i]) << BigInt(8 * i); // LE: low byte first
  }
  return value;
}

// Decode a signed LE integer of 1…8 octets.
export function decodeSignedIntLE(bytes: Uint8Array): bigint {
  console.log("decodeSignedIntLE", bytes);
  if (bytes.length === 0 || bytes.length > 8)
    throw new Error("decodeSignedIntLE: length must be 1-8");

  // Build as unsigned first
  let value = 0n;
  for (let i = 0; i < bytes.length; i++) {
    value |= BigInt(bytes[i]) << (8n * BigInt(i));
  }

  // If MSB of highest byte is set it is negative and sign-extend it
  const msbMask = 1n << (BigInt(bytes.length) * 8n - 1n);
  if (value & msbMask) {
    const fullMask = (1n << (BigInt(bytes.length) * 8n)) - 1n;
    value = value | (~fullMask);          // bitwise NOT full mask to sign-extend
  // the symbol | means bitwise OR, so we are extending the sign bit, bitwise OR means 

  }

  return value;
}


// ONE-IMMEDIATE family decoder (A.20)
export function decodeOneImmediate(
    pc: number,
    code: Uint8Array,
    skipLen: number
  ): DecodedImmediate
  {
    const lX = Math.min(4, skipLen);
    const immBytes = code.slice(pc + 1, pc + 1 + lX);
    return { byteLen: lX, value: decodeSignedIntLE(immBytes) };
  }

export interface DecodedImmediate {
    byteLen: number;          // length of immediate in bytes
    value: bigint;           // decoded immediate value (signed)
}

