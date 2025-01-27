import { Codec } from "scale-ts";
import { AuthQueueCodec } from "./AuthQueueCodec";
import { AUTH_QUEUE_SIZE, CORES_COUNT } from "../../../../consts"; 
import { decodeWithBytesUsed } from "../../../../codecs";
import { toUint8Array, concatAll } from "../../../../codecs";

// 2 sub-arrays, each exactly 2560 bytes
const BYTES_PER_QUEUE = AUTH_QUEUE_SIZE * 32; 

export const AuthQueuesCodec: Codec<Uint8Array[][]> = [
  // ENCODER
  (queues: Uint8Array[][]): Uint8Array => {
    if (queues.length !== CORES_COUNT) {
      throw new Error(`AuthQueues must have length=${CORES_COUNT}, got ${queues.length}`);
    }
    const enc0 = AuthQueueCodec.enc(queues[0]); // 2560 bytes
    const enc1 = AuthQueueCodec.enc(queues[1]); // 2560 bytes
    return concatAll(enc0, enc1); // total 5120
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Uint8Array[][] => {
    const uint8 = toUint8Array(data);

    // 1) The first queue chunk = first 2560 bytes
    if (uint8.length < BYTES_PER_QUEUE) {
      throw new Error(
        `AuthQueuesCodec: not enough data for queue0. Need 2560, got ${uint8.length}`
      );
    }
    const chunk0 = uint8.slice(0, BYTES_PER_QUEUE);
    const { value: q0, bytesUsed: used0 } = decodeWithBytesUsed(AuthQueueCodec, chunk0);

    if (used0 < BYTES_PER_QUEUE) {
      console.warn(
        `AuthQueuesCodec: queue0 used only ${used0} bytes (should be 2560?), leftover in chunk0?`
      );
    }

    // 2) The second queue chunk = next 2560 bytes
    const offset1 = BYTES_PER_QUEUE;
    const totalNeeded = BYTES_PER_QUEUE * 2; // 5120
    if (uint8.length < totalNeeded) {
      throw new Error(
        `AuthQueuesCodec: not enough data for queue1. Need total 5120, got ${uint8.length}`
      );
    }
    const chunk1 = uint8.slice(offset1, offset1 + BYTES_PER_QUEUE);
    const { value: q1, bytesUsed: used1 } = decodeWithBytesUsed(AuthQueueCodec, chunk1);

    if (used1 < BYTES_PER_QUEUE) {
      console.warn(
        `AuthQueuesCodec: queue1 used only ${used1} bytes (should be 2560?), leftover in chunk1?`
      );
    }

    // 3) leftover check
    const offset2 = offset1 + BYTES_PER_QUEUE; // 5120
    if (offset2 < uint8.length) {
      console.warn(
        `AuthQueuesCodec: leftover data? offset2=${offset2}, total=${uint8.length}`
      );
    }

    return [q0, q1];
  },
] as unknown as Codec<Uint8Array[][]>;

AuthQueuesCodec.enc = AuthQueuesCodec[0];
AuthQueuesCodec.dec = AuthQueuesCodec[1];
