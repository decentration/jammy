import { Codec, u32 } from "scale-ts";
import { AccumulatedQueueItem, AccumulatedQueue, WorkPackageHashCodec } from "../types";
import { concatAll, decodeWithBytesUsed, DiscriminatorCodec } from "../../../codecs";
import { EPOCH_LENGTH } from "../../../consts";



export const AccumulatedQueueCodec: Codec<AccumulatedQueue> = [
  // ENCODER
  (queue: AccumulatedQueue): Uint8Array => {
    if (queue.length !== EPOCH_LENGTH) {
      throw new Error(
        `AccumulatedQueueCodec: expected exactly ${EPOCH_LENGTH} items, got=${queue.length}`
      );
    }

    const encodedAll = queue.map(item => AccumulatedQueueItemCodec.enc(item));
    return concatAll(...encodedAll);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AccumulatedQueue => {
    let uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;
    const result: AccumulatedQueue = [];

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    for (let i = 0; i < EPOCH_LENGTH; i++) {
      const item = read(AccumulatedQueueItemCodec);
      result.push(item);
    }
    return result;
  },
] as unknown as Codec<AccumulatedQueue>;
AccumulatedQueueCodec.enc = AccumulatedQueueCodec[0];
AccumulatedQueueCodec.dec = AccumulatedQueueCodec[1];



export const AccumulatedQueueItemCodec: Codec<AccumulatedQueueItem> = [
  // ENCODER
  (item: AccumulatedQueueItem): Uint8Array => {
    const encodedHashes = DiscriminatorCodec(WorkPackageHashCodec).enc(item);
    return encodedHashes;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AccumulatedQueueItem => {
    let uint8 =
      data instanceof Uint8Array 
        ? data 
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // read item
    const hash = DiscriminatorCodec(WorkPackageHashCodec).dec(uint8.slice(offset));
    offset += hash.length;

    return hash ;
  },
] as unknown as Codec<AccumulatedQueueItem>;
AccumulatedQueueItemCodec.enc = AccumulatedQueueItemCodec[0];
AccumulatedQueueItemCodec.dec = AccumulatedQueueItemCodec[1];
