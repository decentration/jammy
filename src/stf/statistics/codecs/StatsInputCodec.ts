import { Codec, u16, u32} from "scale-ts";
import { concatAll, decodeWithBytesUsed, toUint8Array } from "../../../codecs";
import { StatsInput } from "../types";
// import { StatsExtrinsicCodec } from "./StatsExtrinsicCodec";
import { ExtrinsicDataCodec } from "../../../block/ExtrinsicData/ExtrinsicDataCodec";


export const StatsInputCodec: Codec<StatsInput> = [
  (inp: StatsInput) => {
    const slotEnc = u32.enc(inp.slot); // 4 bytes
    const authorEnc = u16.enc(inp.author_index); // 2 bytes
    const extrinsicEnc = ExtrinsicDataCodec.enc(inp.extrinsic);
    return concatAll(slotEnc, authorEnc, extrinsicEnc);
  },
  (data: Uint8Array) => {

    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // decode slot
    const slot = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    // decode author_index
    const author_index = u16.dec(uint8.slice(offset, offset + 2));
    offset += 2;

    // decode extrinsic
    const slice = uint8.slice(offset);
    const { value: extrinsic, bytesUsed } = decodeWithBytesUsed(ExtrinsicDataCodec, slice);
    offset += bytesUsed;

    return { slot, author_index, extrinsic };
  },
] as unknown as Codec<StatsInput>;
StatsInputCodec.enc = StatsInputCodec[0];
StatsInputCodec.dec = StatsInputCodec[1];
