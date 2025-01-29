import { Codec, Bytes } from "scale-ts";
import { DiscriminatorCodec, decodeWithBytesUsed } from "../../../codecs";
import { ReportedPackageCodec } from "../../../types/types";
import { toUint8Array, concatAll } from "../../../codecs/utils";
import { OkData } from "../types";

export const OkDataCodec: Codec<OkData> = [
  // ENCODER
  (data: OkData): Uint8Array => {
    // 1) reported => DiscriminatorCodec(ReportedPackageCodec)
    const encReported = DiscriminatorCodec(ReportedPackageCodec).enc(data.reported);

    // 2) reporters => DiscriminatorCodec(Bytes(32)) for each Ed25519 public key
    const encReporters = DiscriminatorCodec(Bytes(32)).enc(data.reporters);

    return concatAll(encReported, encReporters);
  },

  // DECODER
  (blob: ArrayBuffer | Uint8Array | string): OkData => {
    const uint8 = toUint8Array(blob);
    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    const reported = read(DiscriminatorCodec(ReportedPackageCodec));
    const reporters = read(DiscriminatorCodec(Bytes(32)));

    return { reported, reporters };
  },
] as unknown as Codec<OkData>;

OkDataCodec.enc = OkDataCodec[0];
OkDataCodec.dec = OkDataCodec[1];
