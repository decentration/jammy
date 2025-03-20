
import { Codec, u32 } from "scale-ts";
import { concatAll, decodeWithBytesUsed, ValidatorsInfoCodec } from "../../../codecs";
import { StatsState } from "../types";
import { StatisticsCodec } from "./StatisticsCodec";

export const StatsStateCodec: Codec<StatsState> = [
  // ENCODER
  (state: StatsState) => {
    const encPi = StatisticsCodec.enc(state.pi);
    const encTau = u32.enc(state.tau);
    const encKappa = ValidatorsInfoCodec.enc(state.kappa_prime);

    return concatAll(encPi, encTau, encKappa);
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

    // decode pi
    const { value: piVal, bytesUsed: piUsed } = decodeWithBytesUsed(StatisticsCodec, uint8);
    offset += piUsed;

    // decode tau => 4 bytes
    const tau = u32.dec(uint8.slice(offset, offset + 4));
    offset += 4;

    // decode kappa_prime
    const slice = uint8.slice(offset);
    const { value: kappa_prime, bytesUsed } = decodeWithBytesUsed(ValidatorsInfoCodec, slice);
    offset += bytesUsed;

    return {
      pi: piVal,
      tau,
      kappa_prime,
    };
  },
] as unknown as Codec<StatsState>;
StatsStateCodec.enc = StatsStateCodec[0];
StatsStateCodec.dec = StatsStateCodec[1];
