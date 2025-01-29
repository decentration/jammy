import { DiscriminatorCodec } from "./DiscriminatorCodec";
import { MMRPeakCodec } from "./MMRPeakCodec";
import { MMR } from "../stf/types";
import { Codec } from "scale-ts";

/**
 * MMRCodec that uses DiscriminatorCodec of MMRPeakCodec:
 * 
 *  - The first integer is length of peaks
 *  - Then decode that many MMRPeak items
 */
export const MMRCodec: Codec<MMR> = [
  // Encoder
  (mmr: MMR): Uint8Array => {
    // encode array with DiscriminatorCodec => length + items
    const enc = DiscriminatorCodec(MMRPeakCodec).enc(mmr.peaks);
    return enc;
  },

  // Decoder
  (data: ArrayBuffer | Uint8Array | string): MMR => {
    // decode array => MMRPeak[] => put it in .peaks
    const peaks = DiscriminatorCodec(MMRPeakCodec).dec(data);
    return { peaks };
  },
] as unknown as Codec<MMR>;

MMRCodec.enc = MMRCodec[0];
MMRCodec.dec = MMRCodec[1];
