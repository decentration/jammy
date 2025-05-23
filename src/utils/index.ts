export function toHex(uint8: Uint8Array): string {
    return "0x" + Buffer.from(uint8).toString("hex");
  }
  
export function toHexToggle(bytes: Uint8Array, includePrefix: boolean=false): string {

  if (includePrefix) {
    return `0x${Buffer.from(bytes).toString("hex")}`;
  } else {
    return `${Buffer.from(bytes).toString("hex")}`;
  }
}

export function toHexNoPrefix(bytes: Uint8Array): string {
  return `${Buffer.from(bytes).toString("hex")}`;
}

export function stripHexPrefix(hex: string): string {
  return hex.startsWith("0x") ? hex.slice(2) : hex;
}

// Recursively convert all Uint8Arrays -> hex (for debugging)
export function convertToReadableFormat(obj: any): any {
  if (obj instanceof Uint8Array) {
    return toHex(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(convertToReadableFormat);
  } else if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = convertToReadableFormat(v);
    }
    return result;
  }
  return obj;
}


/**
 * Compare two Uint8Arrays for equality
 * @param h 
 * @param a
 * @returns 
 */
export function arrayEqual(h: Uint8Array, a: Uint8Array): boolean {
  // console.log("arrayEqual: h and a", h, a);
  if (h.length !== a.length) return false;
  for (let i = 0; i < h.length; i++) {
    if (h[i] !== a[i]) return false;
  }
  return true;
}


export function ensureBinary(field: any, expectedLength: number, fieldName: string): Uint8Array {
  if (!(field instanceof Uint8Array)) {
    throw new Error(`${fieldName} is not binary data`);
  }
  if (field.length !== expectedLength) {
    throw new Error(`${fieldName} has wrong length: expected ${expectedLength}, got ${field.length}`);
  }
  return field;
}


  // helper to compare two byte arrays lexicographically, 
  // returns number
  export function compareBytes(a: Uint8Array, b: Uint8Array): number {

    // len gets the minimum length of the two arrays
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) {
      if (a[i] !== b[i]) {
        return a[i] - b[i];
      }
    }
    return a.length - b.length;
  }