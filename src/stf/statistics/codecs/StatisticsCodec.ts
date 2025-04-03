import { Codec } from "scale-ts";
import { PerformanceRecord, PerformanceRecordCodec, Statistics } from "../types";
import { concatAll, CoresStatisticsCodec, decodeWithBytesUsed, ServicesStatisticsCodec } from "../../../codecs";
import { VALIDATOR_COUNT } from "../../../consts";

export const StatisticsCodec: Codec<Statistics> = [
  // ENCODER
  (stats: Statistics): Uint8Array => {
    // 1) Ensure length is exactly the known count
    if (stats.vals_current.length !== VALIDATOR_COUNT) {
      throw new Error(
        `StatisticsCodec: 'current' must have length=${VALIDATOR_COUNT}, got=${stats.vals_current.length}`
      );
    }
    if (stats.vals_last.length !== VALIDATOR_COUNT) {
      throw new Error(
        `StatisticsCodec: 'last' must have length=${VALIDATOR_COUNT}, got=${stats.vals_last.length}`
      );
    }


    // 2) Encode each PerformanceRecord in current and last
    const encodedValsCurrent = stats.vals_current.map((x) => PerformanceRecordCodec.enc(x));
    const encodedValsLast = stats.vals_last.map((x) => PerformanceRecordCodec.enc(x));
    const encodedCores = CoresStatisticsCodec.enc(stats.cores);
    const encodedServices = ServicesStatisticsCodec.enc(stats.services);

    // 3) Concatenate all
    return concatAll(...encodedValsCurrent, ...encodedValsLast, encodedCores, encodedServices);

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
    const vals_current: PerformanceRecord[] = [];

    // decode VALIDATOR_COUNT items for vals_current
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: perf, bytesUsed } = decodeWithBytesUsed(PerformanceRecordCodec, slice);
      // console.log("perf and bytesUsed:", perf, bytesUsed);
      vals_current.push(perf);
      offset += bytesUsed;
    }

    // decode VALIDATOR_COUNT items for 'vals_last'
    const vals_last: PerformanceRecord[] = [];
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: perf, bytesUsed } = decodeWithBytesUsed(PerformanceRecordCodec, slice);
      vals_last.push(perf);
      offset += bytesUsed;
    }

    const cores = CoresStatisticsCodec.dec(uint8.slice(offset));
    offset += cores.length;

    const services = ServicesStatisticsCodec.dec(uint8.slice(offset));
    offset += services.length;
    

    return { vals_current, vals_last, cores, services };
  },
] as unknown as Codec<Statistics>;

StatisticsCodec.enc = StatisticsCodec[0];
StatisticsCodec.dec = StatisticsCodec[1];