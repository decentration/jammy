import { Codec, Encoder, Decoder, u32 } from "scale-ts";
import { ServicesStatisticsMapEntry } from "../types";
import { decodeProtocolInt, encodeProtocolInt } from "./IntegerCodec";
import { ServiceActivityRecordCodec } from "./ServiceActivityRecordCodec";
import { concatAll, decodeWithBytesUsed, toUint8Array } from "./utils";
import { DiscriminatorCodec } from "./DiscriminatorCodec";



export const ServicesStatisticsMapEntryCodec: Codec<ServicesStatisticsMapEntry> = [
  // ---------- ENCODER ----------
  (entry: ServicesStatisticsMapEntry): Uint8Array => {
    const idEncoded = u32.enc(entry.id);
    console.log("ServicesStatisticsMapEntryCodec: enc", idEncoded);
    const recordEncoded = ServiceActivityRecordCodec.enc(entry.record);
    return concatAll(idEncoded, recordEncoded);
  },

  // ---------- DECODER ----------
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    // function readProtocolInt(): number {
    //   const { value, bytesRead } = u32.dec(uint8.slice(offset));
    //   offset += bytesRead;
    //   return value;
    // }

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    // 1) Decode service id
    const id = read(u32);

    // 2) Decode record
    const { value: record, bytesUsed } = decodeWithBytesUsed(
        ServiceActivityRecordCodec,
        uint8.slice(offset));
    offset += bytesUsed;

    const mapEntry: ServicesStatisticsMapEntry = {
      id,
      record,
    };

    return {
      ...mapEntry
    };
  },
] as unknown as Codec<ServicesStatisticsMapEntry>;

ServicesStatisticsMapEntryCodec.enc = ServicesStatisticsMapEntryCodec[0];
ServicesStatisticsMapEntryCodec.dec = ServicesStatisticsMapEntryCodec[1];


export const ServicesStatisticsCodec = DiscriminatorCodec(ServicesStatisticsMapEntryCodec);