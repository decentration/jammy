import { Codec } from "scale-ts";
import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { toUint8Array } from "../../../codecs/utils";
import { AccountsMapEntryCodec } from "./AccountsMapEntryCodec";
import { PreimagesState } from "../types";


const AccountsMapArrayCodec = DiscriminatorCodec(AccountsMapEntryCodec);

export const PreimagesStateCodec: Codec<PreimagesState> = [
  // ENCODER
  (st: PreimagesState): Uint8Array => {
    return AccountsMapArrayCodec.enc(st.accounts);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): PreimagesState => {
    const uint8 = toUint8Array(data);
    const { value: accounts } = decodeWithBytesUsed(AccountsMapArrayCodec, uint8);
    return { accounts };
  },
] as unknown as Codec<PreimagesState>;

PreimagesStateCodec.enc = PreimagesStateCodec[0];
PreimagesStateCodec.dec = PreimagesStateCodec[1];
