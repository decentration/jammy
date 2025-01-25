import { Codec } from "scale-ts";
import { toUint8Array } from "../../../../codecs";
import { AUTH_QUEUE_SIZE } from "../../../../consts"; 

/**
 * Exactly 80 items, each 32 bytes => total 2560 bytes
 */
export const AuthQueueCodec: Codec<Uint8Array[]> = [
  // ENCODER
  (hashes: Uint8Array[]): Uint8Array => {
    if (hashes.length !== AUTH_QUEUE_SIZE) {
      throw new Error(
        `AuthQueue must have exactly ${AUTH_QUEUE_SIZE} items, got ${hashes.length}`
      );
    }
    const out = new Uint8Array(AUTH_QUEUE_SIZE * 32);
    let offset = 0;
    for (let i = 0; i < AUTH_QUEUE_SIZE; i++) {
      const h = hashes[i];
      if (h.length !== 32) {
        throw new Error(`AuthQueue item #${i} is not 32 bytes`);
      }
      out.set(h, offset);
      offset += 32;
    }
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Uint8Array[] => {
    const uint8 = toUint8Array(data);
    const expectedLen = AUTH_QUEUE_SIZE * 32;
    if (uint8.length !== expectedLen) {
      throw new Error(
        `AuthQueue decode: expected ${expectedLen} bytes, got ${uint8.length}`
      );
    }
    const arr: Uint8Array[] = [];
    let offset = 0;
    for (let i = 0; i < AUTH_QUEUE_SIZE; i++) {
      arr.push(uint8.slice(offset, offset + 32));
      offset += 32;
    }
    return arr;
  },
] as unknown as Codec<Uint8Array[]>;

AuthQueueCodec.enc = AuthQueueCodec[0];
AuthQueueCodec.dec = AuthQueueCodec[1];