import { Codec, u16, u32, u64 } from "scale-ts";
import { coerceU64, concatAll, toUint8Array } from "./utils";
import { CoresActivityRecord } from "../types";
import { CORES_COUNT } from "../consts";
import { encodeProtocolInt } from "./IntegerCodec";
import { decodeProtocolIntBig, decodeProtocolIntNumber } from "./IntegerCodec2";

export const CoresActivityRecordCodec: Codec<CoresActivityRecord> = [
  // ENCODER
  (item: CoresActivityRecord): Uint8Array => {
    const daLoad        = u32.enc(item.da_load);
    const popularity    = u16.enc(item.popularity);
    const imports       = u16.enc(item.imports);
    const extrinsicCnt  = u16.enc(item.extrinsic_count);
    const extrinsicSize = u32.enc(item.extrinsic_size);
    const exports       = u16.enc(item.exports);
    const bundleSize    = u32.enc(item.bundle_size);
    const gasUsed       = u64.enc(coerceU64(item.gas_used));
    

    // const daLoad        = encodeProtocolInt(item.da_load);
    // const popularity    = encodeProtocolInt(item.popularity);
    // const imports       = encodeProtocolInt(item.imports);
    // const extrinsicCnt  = encodeProtocolInt(item.extrinsic_count);
    // const extrinsicSize = encodeProtocolInt(item.extrinsic_size);
    // const exports       = encodeProtocolInt(item.exports);
    // const bundleSize    = encodeProtocolInt(item.bundle_size);
    // const gasUsed       = encodeProtocolInt(BigInt(item.gas_used));

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

    const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    const read = (n: number) => { const s = u.slice(off, off + n); off += n; return s; };

    const record: CoresActivityRecord = {
      da_load:         u32.dec(read(4)),
      popularity:      u16.dec(read(2)),
      imports:         u16.dec(read(2)),
      extrinsic_count: u16.dec(read(2)),
      extrinsic_size:  u32.dec(read(4)),
      exports:         u16.dec(read(2)),
      bundle_size:     u32.dec(read(4)),
      gas_used:        u64.dec(read(8))
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

    const encCoresActivityRecord = items.map((item) => CoresActivityRecordCodec.enc(item));
    return concatAll(...encCoresActivityRecord);

  },

  // DECODER
(data: ArrayBuffer | Uint8Array | string): CoresActivityRecord[] => {
    const RECORD_SIZE = 28;
    
    const u = toUint8Array(data);
    const out: CoresActivityRecord[] = [];
    let off = 0;
    for (let i = 0; i < CORES_COUNT; i++) {
      out.push(CoresActivityRecordCodec.dec(u.slice(off, off + RECORD_SIZE)));
      off += RECORD_SIZE;
    }
    return out;
  }
] as unknown as Codec<CoresActivityRecord[]>;

CoresStatisticsCodec.enc = CoresStatisticsCodec[0];
CoresStatisticsCodec.dec = CoresStatisticsCodec[1];

  