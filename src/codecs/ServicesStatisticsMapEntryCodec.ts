import { Codec, Encoder, Decoder } from "scale-ts";
import { ServicesStatisticsMapEntry } from "../types";
import { decodeProtocolInt, encodeProtocolInt } from "./IntegerCodec";
import { ServiceActivityRecordCodec } from "./ServicesStatisticsCodec";
import { concatAll, decodeWithBytesUsed, toUint8Array } from "./utils";
import { DiscriminatorCodec } from "./DiscriminatorCodec";



export const ServicesStatisticsMapEntryCodec: Codec<ServicesStatisticsMapEntry> = [
  // ---------- ENCODER ----------
  (entry: ServicesStatisticsMapEntry): Uint8Array => {
    const idEncoded = encodeProtocolInt(entry.id);
    const recordEncoded = ServiceActivityRecordCodec.enc(entry.record);
    return concatAll(idEncoded, recordEncoded);
  },

  // ---------- DECODER ----------
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    function readProtocolInt(): number {
      const { value, bytesRead } = decodeProtocolInt(uint8.slice(offset));
      offset += bytesRead;
      return value;
    }

    // 1) Decode service id
    const id = readProtocolInt();

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