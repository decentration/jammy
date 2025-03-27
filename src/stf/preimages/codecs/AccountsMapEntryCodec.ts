
import { Codec } from "scale-ts";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { u32 } from "scale-ts";
import { AccountsMapEntry } from "../types";
import { AccountCodec } from "./AccountCodec";


export const AccountsMapEntryCodec: Codec<AccountsMapEntry> = [
  // ENCODER
  (ame: AccountsMapEntry): Uint8Array => {
    const idEnc = u32.enc(ame.id);
    const dataEnc = AccountCodec.enc(ame.data);
    return concatAll(idEnc, dataEnc);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AccountsMapEntry => {
    const uint8 = toUint8Array(data);

    if (uint8.length < 4) {
      throw new Error(`AccountsMapEntryCodec: insufficient data for id`);
    }
    const id = u32.dec(uint8.slice(0, 4));
    const accountSlice = uint8.slice(4);
    const account = AccountCodec.dec(accountSlice);

    return { id, data: account };
  },
] as unknown as Codec<AccountsMapEntry>;

AccountsMapEntryCodec.enc = AccountsMapEntryCodec[0];
AccountsMapEntryCodec.dec = AccountsMapEntryCodec[1];
