import { Codec } from "scale-ts";
import { toUint8Array } from "./utils";
import { DiscriminatorCodec } from "./DiscriminatorCodec";

const OffenderCodec: Codec<Uint8Array> = [
  // 1) Encode => must be exactly 32 bytes
  (off: Uint8Array): Uint8Array => {
    if (off.length !== 32) {
      throw new Error("OffenderCodec: item not 32 bytes");
    }
    return off;
  },

  // 2) Decode
  (data: ArrayBuffer | Uint8Array | string): Uint8Array => {
    const uint8 = toUint8Array(data);
    if (uint8.length < 32) {
      throw new Error("OffenderCodec: not enough data");
    }
    return uint8.slice(0, 32);
  },
] as unknown as Codec<Uint8Array>;

OffenderCodec.enc = OffenderCodec[0];
OffenderCodec.dec = OffenderCodec[1];

export const OffendersMarkCodec = DiscriminatorCodec(OffenderCodec);

