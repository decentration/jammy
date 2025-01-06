export function toHex(uint8: Uint8Array): string {
    return "0x" + Buffer.from(uint8).toString("hex");
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
 
  