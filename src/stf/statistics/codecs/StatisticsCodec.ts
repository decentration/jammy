import { Codec } from "scale-ts";
import { FlatStatsState, PerformanceRecord, PerformanceRecordCodec, Statistics } from "../types";
import { concatAll, CoresStatisticsCodec, decodeWithBytesUsed, encodeProtocolInt, ServicesStatisticsCodec } from "../../../codecs";
import { VALIDATOR_COUNT } from "../../../consts";
import { CurrValidatorsCodec } from "../../assurances/codecs/StateCodec/CurrValidatorsCodec";
import { decodeProtocolInt } from "../../../codecs/IntegerCodec2";

export const StatisticsCodec: Codec<FlatStatsState> = [
  // ENCODER
  (stats: FlatStatsState): Uint8Array => {
    // 1) Ensure length is exactly the known count
    // console.log("StatisticsCodec: enc", stats, stats.vals_curr_stats.length);
    if (stats.vals_curr_stats.length !== VALIDATOR_COUNT) {
      throw new Error(
        `StatisticsCodec: 'current' must have length=${VALIDATOR_COUNT}, got=${stats.vals_curr_stats.length}`
      );
    }
    if (stats.vals_last_stats.length !== VALIDATOR_COUNT) {
      throw new Error(
        `StatisticsCodec: 'last' must have length=${VALIDATOR_COUNT}, got=${stats.vals_last_stats.length}`
      );
    }


    // 2) Encode each PerformanceRecord in current and last
    const encodedValsCurrent = stats.vals_curr_stats.map((x) => PerformanceRecordCodec.enc(x));
    const encodedValsLast = stats.vals_last_stats.map((x) => PerformanceRecordCodec.enc(x));
    // const encodedSlot = encodeProtocolInt(stats.slot);
    // const encodedCurrValidators = CurrValidatorsCodec.enc(stats.curr_validators);

    // 3) Concatenate all
    return concatAll(...encodedValsCurrent, ...encodedValsLast);

  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): FlatStatsState => {
    // Convert to Uint8Array
    const uint8 = data instanceof Uint8Array
      ? data
      : typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);

    let offset = 0;
    const vals_curr_stats: PerformanceRecord[] = [];

    // decode VALIDATOR_COUNT items for vals_curr
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

    // // decode slot (protocol int)
    // const { value: slot, bytesRead: slotBytes } = decodeProtocolInt(uint8.slice(offset));
    // offset += slotBytes;

    // const curr_validators = CurrValidatorsCodec.dec(uint8.slice(offset));
    // offset += curr_validators.length;
    

    return { vals_curr_stats, vals_last_stats };
  },
] as unknown as Codec<FlatStatsState>;

StatisticsCodec.enc = StatisticsCodec[0];
StatisticsCodec.dec = StatisticsCodec[1];