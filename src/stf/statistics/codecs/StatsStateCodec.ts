
import { Codec, u32 } from "scale-ts";
import { concatAll, decodeWithBytesUsed, ValidatorsInfoCodec } from "../../../codecs";
import { PerformanceRecord, PerformanceRecordCodec, StatsState } from "../types";
import { VALIDATOR_COUNT } from "../../../consts";

export const StatsStateCodec: Codec<StatsState> = [
  // ENCODER
  (state: StatsState) => {
    const encodedValsCurrent = state.vals_curr_stats.map((x) => PerformanceRecordCodec.enc(x));
    const encodedValsLast = state.vals_last_stats.map((x) => PerformanceRecordCodec.enc(x));
    const encSlots = u32.enc(state.slot);
    const encCurrValidators = ValidatorsInfoCodec.enc(state.curr_validators);

    return concatAll(...encodedValsCurrent, ...encodedValsLast, encSlots, encCurrValidators);
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


  // decode VALIDATOR_COUNT items for vals_curr
      const vals_curr_stats: PerformanceRecord[] = [];
  
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: perf, bytesUsed } = decodeWithBytesUsed(PerformanceRecordCodec, slice);
      // console.log("perf and bytesUsed:", perf, bytesUsed);
      vals_curr_stats.push(perf);
      offset += bytesUsed;
    }

    // decode VALIDATOR_COUNT items for 'vals_last'
    const vals_last_stats: PerformanceRecord[] = [];
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: perf, bytesUsed } = decodeWithBytesUsed(PerformanceRecordCodec, slice);
      vals_last_stats.push(perf);
      offset += bytesUsed;
    }

    // decode slot => 4 bytes
    const slot = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    // decode curr_validators
    const slice = uint8.slice(offset);
    const { value: curr_validators, bytesUsed } = decodeWithBytesUsed(ValidatorsInfoCodec, slice);
    offset += bytesUsed;

    return {
      vals_curr_stats,
      vals_last_stats,
      slot,
      curr_validators,
    };
  },
] as unknown as Codec<StatsState>;
StatsStateCodec.enc = StatsStateCodec[0];
StatsStateCodec.dec = StatsStateCodec[1];
