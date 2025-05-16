
import { Codec, u32 } from "scale-ts";
import { concatAll, decodeWithBytesUsed, ValidatorsInfoCodec } from "../../../codecs";
import { StatsState } from "../types";
import { StatisticsCodec } from "./StatisticsCodec";

export const StatsStateCodec: Codec<StatsState> = [
  // ENCODER
  (state: StatsState) => {
    const encStats = StatisticsCodec.enc(state.statistics);
    const encSlots = u32.enc(state.slot);
    const encCurrValidators = ValidatorsInfoCodec.enc(state.curr_validators);

    return concatAll(encStats, encSlots, encCurrValidators);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): StatsState => {
    // console.log("StatsStateCodec.dec", data);

    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // decode statistics
    const { value: statsVal, bytesUsed: statsUsed } = decodeWithBytesUsed(StatisticsCodec, uint8);
    offset += statsUsed;

    // decode slot => 4 bytes
    const slot = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    // decode curr_validators
    const slice = uint8.slice(offset);
    const { value: curr_validators, bytesUsed } = decodeWithBytesUsed(ValidatorsInfoCodec, slice);
    offset += bytesUsed;

    return {
      statistics: statsVal,
      slot,
      curr_validators,
    };
  },
] as unknown as Codec<StatsState>;
StatsStateCodec.enc = StatsStateCodec[0];
StatsStateCodec.dec = StatsStateCodec[1];
