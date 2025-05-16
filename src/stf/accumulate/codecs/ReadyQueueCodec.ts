import { Codec } from "scale-ts";
import { concatAll, decodeWithBytesUsed, DiscriminatorCodec, ReportCodec } from "../../../codecs";
import { ReadyQueue, ReadyRecord, WorkPackageHashCodec } from "../types";
import { EPOCH_LENGTH } from "../../../consts";

 const ReadyRecordCodec: Codec<ReadyRecord> = [
  // ENCODER
  (records: ReadyRecord): Uint8Array => {
    // Encode
    const encReport = ReportCodec.enc(records.report);
    const encDependencies = DiscriminatorCodec(WorkPackageHashCodec).enc(records.dependencies);

    // Concatenate
    return concatAll(encReport, encDependencies);
  },
  // DECODER
  (data: ArrayBuffer | Uint8Array | string): ReadyRecord => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    { 
        const { value, bytesUsed } = decodeWithBytesUsed(ReportCodec, uint8.slice(offset));
        console.log('read report', value, bytesUsed);
        offset += bytesUsed;
        var report = value;
    }

    { 
      const { value, bytesUsed } = decodeWithBytesUsed(DiscriminatorCodec(WorkPackageHashCodec), uint8.slice(offset));
      offset += bytesUsed;
      var dependencies = value;
    }

    return { report, dependencies };
  },
] as unknown as Codec<ReadyRecord>;
ReadyRecordCodec.enc = ReadyRecordCodec[0];
ReadyRecordCodec.dec = ReadyRecordCodec[1];

const ReadyQueueItemCodec = DiscriminatorCodec(ReadyRecordCodec);

export const ReadyQueueCodec: Codec<ReadyQueue> = {
    enc: (queue: ReadyQueue): Uint8Array => {
      // queue is an array of length EPOCH_LENGTH
      if (queue.length !== EPOCH_LENGTH) {
        throw new Error(
          `ReadyQueueCodec: expected exactly ${EPOCH_LENGTH} items, got=${queue.length}`
        );
      }

      // (assignments: AvailAssignmentsArray): Uint8Array => {
      //   if (assignments.length !== CORES_COUNT) {
      //     throw new Error(
      //       `AvailAssignmentsCodec.enc: expected exactly ${CORES_COUNT} items, got ${assignments.length}`
      //     );
      //   }
    
      //   // Encode each item and concatenate
      //   const encodedItems = assignments.map((item) => AvailAssignmentsItemCodec.enc(item));
      //   const totalSize = encodedItems.reduce((acc, buf) => acc + buf.length, 0);
      //   const out = new Uint8Array(totalSize);
      //   let offset = 0;
    
      //   for (const enc of encodedItems) {
      //     out.set(enc, offset);
      //     offset += enc.length;
      //   }
    
      //   return out;
      // },
      // encode each ReadyQueueItem in turn
      const encodedItems = queue.map((item) => ReadyQueueItemCodec.enc(item));
      const totalSize = encodedItems.reduce((acc, buf) => acc + buf.length, 0);
      const out = new Uint8Array(totalSize);  
      let offset = 0;

      for (const enc of encodedItems) {
        out.set(enc, offset);
        offset += enc.length;
      }
  
      console.log("ReadyQueueCodec: enc", queue, out);
      return out;
    },
  
    dec: (data: ArrayBuffer | Uint8Array | string): ReadyQueue => {
      const uint8 =
        data instanceof Uint8Array
          ? data
          : typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);
  
      let offset = 0;
      const result: ReadyQueue = [];
  
      function read<T>(codec: Codec<T>): T {
        const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
        offset += bytesUsed;
        return value;
      }
  
      for (let i = 0; i < EPOCH_LENGTH; i++) {
        const item = read(ReadyQueueItemCodec);
        result.push(item);
      }
      return result;
    }
  } as unknown as Codec<ReadyQueue>;
ReadyQueueCodec.enc = ReadyQueueCodec.enc;
ReadyQueueCodec.dec = ReadyQueueCodec.dec;  