import { Codec, u16, u32, u64 } from "scale-ts";
import { coerceU64, concatAll, decodeWithBytesUsed, toUint8Array } from "./utils";
import { CoresActivityRecord } from "../types";
import { CORES_COUNT } from "../consts";
import { decodeProtocolIntBig, decodeProtocolIntNumber, encodeProtocolInt } from "./IntegerCodec2";

export const CoresActivityRecordCodec: Codec<CoresActivityRecord> = [
  // ENCODER
  (item: CoresActivityRecord): Uint8Array => {
    // const daLoad        = u32.enc(item.da_load);
    // const popularity    = u16.enc(item.popularity);
    // const imports       = u16.enc(item.imports);
    // const extrinsicCnt  = u16.enc(item.extrinsic_count);
    // const extrinsicSize = u32.enc(item.extrinsic_size);
    // const exports       = u16.enc(item.exports);
    // const bundleSize    = u32.enc(item.bundle_size);
    // const gasUsed       = u64.enc(coerceU64(item.gas_used));
    

    const daLoad        = encodeProtocolInt(item.da_load);
    const popularity    = encodeProtocolInt(item.popularity);
    const imports       = encodeProtocolInt(item.imports);
    const extrinsicCnt  = encodeProtocolInt(item.extrinsic_count);
    const extrinsicSize = encodeProtocolInt(item.extrinsic_size);
    const exports       = encodeProtocolInt(item.exports);
    const bundleSize    = encodeProtocolInt(item.bundle_size);
    const gasUsed       = encodeProtocolInt(coerceU64(item.gas_used));

    return concatAll(
     daLoad,
     popularity,
     imports,
     extrinsicCnt,
     extrinsicSize,
     exports,
     bundleSize,
     gasUsed
    );
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string) => {
    const u = toUint8Array(data);
    let off = 0;

 
    function readProtocolInt(): number {
      const { value, bytesRead } = decodeProtocolIntNumber(u.slice(off));
      off += bytesRead;
      return value;
    }

    function readProtocolIntBig(): bigint {
      const { value, bytesRead } = decodeProtocolIntBig(u.slice(off));
      off += bytesRead;
      return value;
    }

    const record: CoresActivityRecord = {
      da_load:         readProtocolInt(),
      popularity:      readProtocolInt(),
      imports:         readProtocolInt(),
      extrinsic_count: readProtocolInt(),
      extrinsic_size:  readProtocolInt(),
      exports:         readProtocolInt(),
      bundle_size:     readProtocolInt(),
      gas_used:        readProtocolIntBig(),
    };

    return record;
    
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

    const encCoresActivityRecords = items.map((item) => CoresActivityRecordCodec.enc(item));
    return concatAll(...encCoresActivityRecords);

  },

  // DECODER
(data: ArrayBuffer | Uint8Array | string): CoresActivityRecord[] => {
    
    const u = toUint8Array(data);
    const out: CoresActivityRecord[] = [];
    let off = 0;
    for (let i = 0; i < CORES_COUNT; i++) {
      const { value, bytesUsed } = decodeWithBytesUsed(CoresActivityRecordCodec, u.slice(off));
      out.push(value);
      off += bytesUsed;
      if (off > u.length) {
        throw new Error(`CoresStatisticsCodec.dec: ran past end while decoding item #${i}`);
      }
    }
    return out;
  }
] as unknown as Codec<CoresActivityRecord[]>;

CoresStatisticsCodec.enc = CoresStatisticsCodec[0];
CoresStatisticsCodec.dec = CoresStatisticsCodec[1];

  