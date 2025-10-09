import { Codec } from "scale-ts";
import { DiscriminatorCodec, MMRCodec, decodeWithBytesUsed } from "../../../codecs";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { BlockItemCodec } from "../../../codecs";
import { BlockItem, RecentBlocks } from "../../types";
import { MAX_BLOCKS_HISTORY } from "../../../consts";


export const RecentBlocksCodec: Codec<RecentBlocks> = [
  (rb: RecentBlocks) => {
    const encHistory = DiscriminatorCodec(BlockItemCodec, { maxSize: MAX_BLOCKS_HISTORY}).enc(rb.history);
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
] as unknown as Codec<RecentBlocks>;

RecentBlocksCodec.enc = RecentBlocksCodec[0];
RecentBlocksCodec.dec = RecentBlocksCodec[1];

// export const BetaCodec = DiscriminatorCodec(RecentBlocksCodec);