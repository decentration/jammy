
import { Codec } from "scale-ts";
import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { PreimagesMapEntryCodec } from "./PreimagesMapEntryCodec";
import { LookupMetaMapEntryCodec } from "./LookupMetaMapEntryCodec";
import { Account, LookupMetaMapEntry, PreimagesMapEntry } from "../types";

const PreimagesMapArrayCodec = DiscriminatorCodec(PreimagesMapEntryCodec);
const LookupMetaMapArrayCodec = DiscriminatorCodec(LookupMetaMapEntryCodec);

export const AccountCodec: Codec<Account> = [
  // ENCODER
  (acc: Account): Uint8Array => {
    const preimagesEnc = PreimagesMapArrayCodec.enc(acc.preimages);
    const lookupEnc = LookupMetaMapArrayCodec.enc(acc.lookup_meta);
    return concatAll(preimagesEnc, lookupEnc);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Account => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    {
      const slice = uint8.slice(offset);
      const { value: preimages, bytesUsed } = decodeWithBytesUsed(PreimagesMapArrayCodec, slice);
      offset += bytesUsed;
      var preimages_ = preimages as PreimagesMapEntry[];
    }
    
    {
      const slice = uint8.slice(offset);
      const { value: lookup_meta, bytesUsed } = decodeWithBytesUsed(LookupMetaMapArrayCodec, slice);
      offset += bytesUsed;
      var lookup_meta_ = lookup_meta as LookupMetaMapEntry[];
    }

    return { preimages: preimages_, lookup_meta: lookup_meta_ };
  },
] as unknown as Codec<Account>;

AccountCodec.enc = AccountCodec[0];
AccountCodec.dec = AccountCodec[1];
