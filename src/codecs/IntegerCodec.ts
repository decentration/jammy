/**
 * encodeProtocolInt:
 * A very minimal version of the protocol's integer-encoding for 0 <= x < 128.
 * Returns single byte if x < 128,i.e. 0..127 => 0x00..0x7F.
 */
export function encodeProtocolInt(x: number): Uint8Array {
  console.log(`encodeProtocolInt called with x=${x}`);

    if (x < 0) {
      throw new Error(`encodeProtocolInt: cannot encode negative value ${x}`);
    }
  if (x === 0) {
    return Uint8Array.of(0);
  }
    if (x < 128) {
      // Single-byte for small x
      return Uint8Array.of(x);
    }
    // TODO we need more bytes for x >= 128, follow (C.6) from GP. For now we throw:
    throw new Error(`encodeProtocolInt: not implemented for x >= 128`);
  }
  

  export function decodeProtocolInt(data: Uint8Array): { value: number; bytesRead: number } {
    // log string hex
    // console.log(`decodeProtocolInt called with data=${Buffer.from(data).toString('hex')}`);
    if (data.length === 0) {
      throw new Error('decodeProtocolInt: no data to decode');
    }
  
    const x = data[0];
    if (x >= 128) {
      // console.log(`decodeProtocolInt: x=${x} >= 128`);
      throw new Error(`decodeProtocolInt: not implemented for x >= 128`);
    }
    
    return { value: x, bytesRead: 1 };
  }
  