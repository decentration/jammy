import { Codec, u32 } from "scale-ts";
import { toUint8Array, decodeWithBytesUsed, DiscriminatorCodec, concatAll } from "../../../codecs";
import { AccountItem, AccountData, AccountIdCodec } from "../types";
import { AccountDataCodec } from "./AccountDataCodec";

export const AccountItemCodec: Codec<AccountItem> = [
  // ENCODER
  (data: AccountItem): Uint8Array => {
console.log("AccountItemCodec: enc", data);
    const encId = AccountIdCodec.enc(data.id);
    const encData = AccountDataCodec.enc(data.data);

    console.log("AccountItemCodec: enc", encId, encData);
    return concatAll(encId, encData);
  },

  // DECODER
  (input: ArrayBuffer | Uint8Array | string): AccountItem => {
    const uint8 = toUint8Array(input);
    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    const id = AccountIdCodec.dec(uint8.slice(offset));
    offset += 4;
    const data = read(AccountDataCodec);

    return { id, data };
  },
] as unknown as Codec<AccountItem>;

AccountItemCodec.enc = AccountItemCodec[0];
AccountItemCodec.dec = AccountItemCodec[1];


export const AccountsCodec = DiscriminatorCodec(AccountItemCodec);

