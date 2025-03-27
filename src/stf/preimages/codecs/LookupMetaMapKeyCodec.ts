import { Codec } from "scale-ts";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { u32 } from "scale-ts";
import { LookupMetaMapKey } from "../types";


export const LookupMetaMapKeyCodec: Codec<LookupMetaMapKey> = [
  // ENCODER
  (key: LookupMetaMapKey): Uint8Array => {
    if (key.hash.length !== 32) {
      throw new Error(`LookupMetaMapKeyCodec: hash must be 32 bytes`);
    }
    const lengthEnc = u32.enc(key.length);
    return concatAll(key.hash, lengthEnc);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): LookupMetaMapKey => {
    const uint8 = toUint8Array(data);
    if (uint8.length < 36) {
      throw new Error(`LookupMetaMapKeyCodec: need 36 bytes total`);
    }
    const hash = uint8.slice(0, 32);
    const length = u32.dec(uint8.slice(32, 36));
    return { hash, length };
  },
] as unknown as Codec<LookupMetaMapKey>;

LookupMetaMapKeyCodec.enc = LookupMetaMapKeyCodec[0];
LookupMetaMapKeyCodec.dec = LookupMetaMapKeyCodec[1];
