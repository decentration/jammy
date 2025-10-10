import { Codec } from "scale-ts";
import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { decodeWithBytesUsed, ServicesStatisticsCodec } from "../../../codecs";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { AccountsMapEntryCodec } from "./AccountsMapEntryCodec";
import { PreimagesState } from "../types";


const AccountsMapArrayCodec = DiscriminatorCodec(AccountsMapEntryCodec);

export const PreimagesStateCodec: Codec<PreimagesState> = [
  // ENCODER
  (st: PreimagesState): Uint8Array => {
    const encAccounts = AccountsMapArrayCodec.enc(st.accounts);
    const encServicesStatistics = ServicesStatisticsCodec.enc(st.statistics);// TODO apply this to preimages pipelines (provided_count and provided_size )
    return concatAll(encAccounts, encServicesStatistics);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): PreimagesState => {
    const uint8 = toUint8Array(data);
    // 1) accounts (var-len)
    const { value: accounts, bytesUsed: b0 } =
      decodeWithBytesUsed(AccountsMapArrayCodec, uint8);

    // 2) statistics (var-len)
    const { value: statistics, bytesUsed: b1 } =
      decodeWithBytesUsed(ServicesStatisticsCodec, uint8.slice(b0));

    return { accounts, statistics };
  },
] as unknown as Codec<PreimagesState>;

PreimagesStateCodec.enc = PreimagesStateCodec[0];
PreimagesStateCodec.dec = PreimagesStateCodec[1];
