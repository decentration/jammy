import { Codec } from "scale-ts";
import { DiscriminatorCodec, MMRCodec, decodeWithBytesUsed } from "../../../codecs";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { BlockItemCodec } from "../../../codecs";
import { BetaState } from "../../types";


export const RecentBlocksCodec: Codec<BetaState> = [
  (rb: BetaState) => {
    const encHistory = DiscriminatorCodec(BlockItemCodec).enc(rb.history);
    const encMMR     = MMRCodec.enc(rb.mmr);
    return concatAll(encHistory, encMMR);
  },
  (data: Uint8Array) => {
    const u = toUint8Array(data);
    let offset = 0;

    const { value: history, bytesUsed: hUsed } = decodeWithBytesUsed(DiscriminatorCodec(BlockItemCodec), u.slice(offset));
    offset += hUsed;

    const { value: mmr, bytesUsed: mUsed } = decodeWithBytesUsed(MMRCodec, u.slice(offset));
    offset += mUsed;

    return { history, mmr};
  },
] as unknown as Codec<BetaState>;

RecentBlocksCodec.enc = RecentBlocksCodec[0];
RecentBlocksCodec.dec = RecentBlocksCodec[1];
