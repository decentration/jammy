import { Codec } from "scale-ts";
import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { u32 } from "scale-ts";
import { LookupMetaMapEntry } from "../types";
import { LookupMetaMapKeyCodec } from "./LookupMetaMapKeyCodec";

const TimeSlotArrayCodec: Codec<number[]> = DiscriminatorCodec<number>(
  u32,
);

export const LookupMetaMapEntryCodec: Codec<LookupMetaMapEntry> = [
  // ENCODER
  (entry: LookupMetaMapEntry): Uint8Array => {
    const keyEnc = LookupMetaMapKeyCodec.enc(entry.key);
    const valEnc = TimeSlotArrayCodec.enc(entry.value);
    return concatAll(keyEnc, valEnc);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): LookupMetaMapEntry => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    if (uint8.length < 36) {
      throw new Error(`LookupMetaMapEntryCodec: insufficient data for key`);
    }
    const key = LookupMetaMapKeyCodec.dec(uint8.slice(offset, offset + 36));
    offset += 36;

    const slice = uint8.slice(offset);
    const { value: times, bytesUsed } = decodeWithBytesUsed(TimeSlotArrayCodec, slice);
    offset += bytesUsed;

    return { key, value: times };
  },
] as unknown as Codec<LookupMetaMapEntry>;

LookupMetaMapEntryCodec.enc = LookupMetaMapEntryCodec[0];
LookupMetaMapEntryCodec.dec = LookupMetaMapEntryCodec[1];
