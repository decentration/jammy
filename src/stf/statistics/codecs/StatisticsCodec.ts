import { Codec } from "scale-ts";
import { PerformanceRecord, PerformanceRecordCodec, Statistics } from "../types";
import { concatAll, decodeWithBytesUsed } from "../../../codecs";
import { VALIDATOR_COUNT } from "../../../consts";

export const StatisticsCodec: Codec<Statistics> = [
  // ENCODER
  (stats: Statistics): Uint8Array => {
    // 1) Ensure length is exactly the known count
    if (stats.current.length !== VALIDATOR_COUNT) {
      throw new Error(
        `StatisticsCodec: 'current' must have length=${VALIDATOR_COUNT}, got=${stats.current.length}`
      );
    }
    if (stats.last.length !== VALIDATOR_COUNT) {
      throw new Error(
        `StatisticsCodec: 'last' must have length=${VALIDATOR_COUNT}, got=${stats.last.length}`
      );
    }

    // 2) Encode each PerformanceRecord in current and last
    const encodedCurrent = stats.current.map((x) => PerformanceRecordCodec.enc(x));
    const encodedLast = stats.last.map((x) => PerformanceRecordCodec.enc(x));

    // 3) Concatenate all
    return concatAll(...encodedCurrent, ...encodedLast);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Statistics => {
    // Convert to Uint8Array
    const uint8 = data instanceof Uint8Array
      ? data
      : typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);

    let offset = 0;
    const current: PerformanceRecord[] = [];

    // decode VALIDATOR_COUNT items for current
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: perf, bytesUsed } = decodeWithBytesUsed(PerformanceRecordCodec, slice);
      console.log("perf and bytesUsed:", perf, bytesUsed);
      current.push(perf);
      offset += bytesUsed;
    }

    // decode VALIDATOR_COUNT items for 'last'
    const last: PerformanceRecord[] = [];
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: perf, bytesUsed } = decodeWithBytesUsed(PerformanceRecordCodec, slice);
      last.push(perf);
      offset += bytesUsed;
    }

    return { current, last };
  },
] as unknown as Codec<Statistics>;

StatisticsCodec.enc = StatisticsCodec[0];
StatisticsCodec.dec = StatisticsCodec[1];