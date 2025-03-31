import { Codec } from "scale-ts";
import { encodeProtocolInt, decodeProtocolInt } from "./IntegerCodec";
import { concatAll, toUint8Array } from "./utils";
import { CoresActivityRecord } from "../types";
import { DiscriminatorCodec } from "./DiscriminatorCodec";
import { CORES_COUNT } from "../consts";
import { concat } from "fp-ts/lib/ReadonlyNonEmptyArray";

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
      const { value, bytesRead } = decodeProtocolInt(uint8.slice(offset));
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
      ...record,
    };

    
  },

  
] as unknown as Codec<CoresActivityRecord>;

CoresActivityRecordCodec.enc = CoresActivityRecordCodec[0];
CoresActivityRecordCodec.dec = CoresActivityRecordCodec[1];


export const CoresStatisticsCodec: Codec<CoresActivityRecord[]> = [
  // ENCODER
  (items: CoresActivityRecord[]): Uint8Array => {

    if (items.length !== CORES_COUNT) {
      throw new Error(`CoresStatisticsCodec: expected ${CORES_COUNT} items, got ${items.length}`);
    }

    const encCoresActivityRecord = items.map((item) => CoresActivityRecordCodec.enc(item));
    return concatAll(...encCoresActivityRecord);

  },

  // DECODER
(data: ArrayBuffer | Uint8Array | string): CoresActivityRecord[] => {
      const uint8 = toUint8Array(data);
    let offset = 0;

    const results: CoresActivityRecord[] = [];
    for (let i = 0; i < CORES_COUNT; i++) {
      function readProtocolInt(): number {
        const { value, bytesRead } = decodeProtocolInt(uint8.slice(offset));
        offset += bytesRead;
        return value;
      }

      const gas_used = readProtocolInt();
      const imports = readProtocolInt();
      const extrinsic_count = readProtocolInt();
      const extrinsic_size = readProtocolInt();
      const exports = readProtocolInt();
      const bundle_size = readProtocolInt();
      const da_load = readProtocolInt();
      const popularity = readProtocolInt();

      results.push({
        gas_used,
        imports,
        extrinsic_count,
        extrinsic_size,
        exports,
        bundle_size,
        da_load,
        popularity,
      });
  
    }

    return results;
  },
] as unknown as Codec<CoresActivityRecord[]>;

CoresStatisticsCodec.enc = CoresStatisticsCodec[0];
CoresStatisticsCodec.dec = CoresStatisticsCodec[1];

  