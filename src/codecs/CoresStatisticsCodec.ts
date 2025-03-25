import { Codec } from "scale-ts";
import { encodeProtocolInt, decodeProtocolInt } from "./IntegerCodec";
import { concatAll, toUint8Array } from "./utils";
import { CoresActivityRecord } from "../types";
import { DiscriminatorCodec } from "./DiscriminatorCodec";



export const CoresActivityRecordCodec: Codec<CoresActivityRecord> = [
  // ENCODER
  (item: CoresActivityRecord): Uint8Array => {
    const gasUsed       = encodeProtocolInt(item.gas_used);
    const imports       = encodeProtocolInt(item.imports);
    const extrinsicCnt  = encodeProtocolInt(item.extrinsic_count);
    const extrinsicSize = encodeProtocolInt(item.extrinsic_size);
    const exports       = encodeProtocolInt(item.exports);
    const bundleSize    = encodeProtocolInt(item.bundle_size);
    const daLoad        = encodeProtocolInt(item.da_load);
    const popularity    = encodeProtocolInt(item.popularity);

    return concatAll(
      gasUsed,
      imports,
      extrinsicCnt,
      extrinsicSize,
      exports,
      bundleSize,
      daLoad,
      popularity
    );
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    function readProtocolInt(): number {
      const { value, bytesRead } = decodeProtocolInt(uint8.subarray(offset));
      offset += bytesRead;
      return value;
    }

    const gas_used       = readProtocolInt();
    const imports        = readProtocolInt();
    const extrinsicCount = readProtocolInt();
    const extrinsicSize  = readProtocolInt();
    const exports        = readProtocolInt();
    const bundleSize     = readProtocolInt();
    const daLoad         = readProtocolInt();
    const popularity     = readProtocolInt();

    const record: CoresActivityRecord = {
      gas_used,
      imports,
      extrinsic_count: extrinsicCount,
      extrinsic_size: extrinsicSize,
      exports,
      bundle_size: bundleSize,
      da_load: daLoad,
      popularity,
    };

    return {
      value: record,
      bytesUsed: offset,
    };
  },
] as unknown as Codec<CoresActivityRecord>;

CoresActivityRecordCodec.enc = CoresActivityRecordCodec[0];
CoresActivityRecordCodec.dec = CoresActivityRecordCodec[1];

export const CoresStatisticsCodec = DiscriminatorCodec<CoresActivityRecord>(CoresActivityRecordCodec);