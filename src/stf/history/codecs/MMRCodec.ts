import { Codec } from "scale-ts";
import { MMR } from "../../types";
import { decodeWithBytesUsed } from "../../../codecs";
import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { MMRPeakCodec } from "./MMRPeakCodec";

/**
 * MMRCodec:
 * - 0x00 => None => MMR.peaks = []
 * - 0x01 => Some => followed by a length-prefix, then that many MMRPeak items
 
**/
export const MMRCodec: Codec<MMR> = [
  // ENCODER
  (mmr: MMR): Uint8Array => {
    const peaks = mmr.peaks || [];
    if (peaks.length === 0) {
      // None
      return Uint8Array.of(0x00);
    }

    // Some
    // 1) prefix 0x01
    // 2) length-prefixed array of MMRPeak
 
    const encPeaks = DiscriminatorCodec(MMRPeakCodec).enc(peaks);

    // total = 1 (prefix) + encoded-peaks-length
    const out = new Uint8Array(1 + encPeaks.length);
    out[0] = 0x01;
    out.set(encPeaks, 1);
    console.log('MMRCodec: enc out :', out);
    return out;
  },


  // DECODER

  (data: ArrayBuffer | Uint8Array | string): MMR => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length === 0) {
      throw new Error("MMRCodec: no data available to decode");
    }

    const prefix = uint8[0];
    let offset = 1;

    // 0x00 => None => empty array
    if (prefix === 0x00) {
      return { peaks: [] };
    }
    // console.log('MMRCodec: dec :', prefix, data);
    // 0x01 => Some => decode a length-prefixed array of MMRPeak
    if (prefix === 0x01) {
      const slice = uint8.slice(offset);
      const { value: peaks, bytesUsed } = decodeWithBytesUsed(
        DiscriminatorCodec(MMRPeakCodec),
        slice
      );
      offset += bytesUsed;
      return { peaks };
    }

    throw new Error(`MMRCodec: invalid prefix 0x${prefix.toString(16)}`);
  },
] as unknown as Codec<MMR>;


MMRCodec.enc = MMRCodec[0];
MMRCodec.dec = MMRCodec[1];
