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
    return `0x${Buffer.from(bytes).toString("hex")}`;
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
 

  export function arrayEqual(h: Uint8Array, a: Uint8Array): boolean {
    if (h.length !== a.length) return false;
    for (let i = 0; i < h.length; i++) {
      if (h[i] !== a[i]) return false;
    }
    return true;
  }