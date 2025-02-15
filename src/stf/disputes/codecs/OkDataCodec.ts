import { Codec } from "scale-ts";
import { OkData } from "../types";
import { OffendersMarkCodec } from "../../../codecs";
import { decodeWithBytesUsed, toUint8Array } from "../../../codecs/utils";

/**
 * OkData => { offenders_mark: OffendersMark[] }
 */
export const OkDataCodec: Codec<OkData> = [
  // ENCODER
  (data: OkData): Uint8Array => {
    return OffendersMarkCodec.enc(data.offenders_mark);
  },

  // DECODER
  (blob: ArrayBuffer | Uint8Array | string): OkData => {
    const uint8 = toUint8Array(blob);
    const { value: array } = decodeWithBytesUsed(OffendersMarkCodec, uint8);
    return { offenders_mark: array };
  },
] as unknown as Codec<OkData>;

OkDataCodec.enc = OkDataCodec[0];
OkDataCodec.dec = OkDataCodec[1];
