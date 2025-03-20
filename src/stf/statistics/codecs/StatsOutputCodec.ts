import { Codec } from "scale-ts";
import { StatsOutput } from "../types";

/**
 * StatsOutput is always NULL
 */
export const StatsOutputCodec: Codec<StatsOutput> = [
  // ENCODER
  (): Uint8Array => {
    return new Uint8Array();
  },
  // DECODER
  (data: ArrayBuffer | Uint8Array | string): StatsOutput => {
    return null;
  },
] as unknown as Codec<StatsOutput>;
StatsOutputCodec.enc = StatsOutputCodec[0];
StatsOutputCodec.dec = StatsOutputCodec[1];

