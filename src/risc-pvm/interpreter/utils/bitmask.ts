/* Opcode bitmask into boolean array
    * - LSB-first, matches spec
    * - k MAY have trailing bits from alignment
    * - Truncated to exactly |c| octets
    * * @param bitmask - Uint8Array representing the bitmask
    * @returns boolean[] - Array of booleans representing the bitmask
*/
export function bitmaskToBoolean(bitmask: Uint8Array, codeByteLen: number): boolean[] {
    const totalBits = bitmask.length;
    const expectedBytes = Math.ceil(codeByteLen / 8); // of course opcode mask is stored in octets, so we round up by 8s. 
    console.log("bitmaskoBoolean: totalBits", totalBits, "expectedBytes", expectedBytes, "codeByteLen", codeByteLen);
    if (totalBits < expectedBytes) {
      throw new Error(
        `Bitmask length mismatch: bitmask has fewer bits ${totalBits}, than the required ${codeByteLen}`
      );
    }

    const out: boolean[] = [];
    for (const byte of bitmask) {
      for (let b = 0; b < 8; b++) {
        out.push(Boolean(byte & (1 << b)));
        if (out.length === codeByteLen) return out; // stop exactly at |c|
      }
    }
    
    return out.slice(0, bitmask.length * 8); // Truncate to exactly |c| octets (k MAY have trailing bits from alignment)
  }