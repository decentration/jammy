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
    const recordEncoded = ServiceActivityRecordCodec.enc(entry.record);

    return concatAll(idEncoded, recordEncoded);
  },

  // ---------- DECODER ----------
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 = toUint8Array(data);

    console.log('ServicesStatisticsMapEntryCodec.dec data', uint8);
    // 1) Decode service id
    const id = u32.dec(uint8.subarray(0, 4));

    // 2) Decode record
    const { value: record } = decodeWithBytesUsed(ServiceActivityRecordCodec, uint8.subarray(4));
    
    return { id, record }

  },
] as unknown as Codec<ServicesStatisticsMapEntry>;

ServicesStatisticsMapEntryCodec.enc = ServicesStatisticsMapEntryCodec[0];
ServicesStatisticsMapEntryCodec.dec = ServicesStatisticsMapEntryCodec[1];


export const ServicesStatisticsCodec = DiscriminatorCodec(ServicesStatisticsMapEntryCodec);