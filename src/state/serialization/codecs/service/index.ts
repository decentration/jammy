import { Struct, Bytes, u64,u32, Codec } from "scale-ts";
import { VarLenBytesCodec } from "../../../../codecs";
import { PairListCodec } from "../PairListCodec";


export interface ServiceAccount {
  header : ServiceAccountHeader;
  data   : ServiceInnerData;
}

export interface ServiceInnerData {
  storage   : [Uint8Array, Uint8Array][];  // key-value
  preimages : [Uint8Array, Uint8Array][];  // hash-blob
  lookup    : [number    , Uint8Array][];  // idx-root
}


export interface ServiceAccountHeader {
  code_hash: Uint8Array;   // Bytes(32)
  balance  : bigint;       // u64
}


// 32 byte key => arbitrary-length value
export const StoragePairListCodec   = PairListCodec(Bytes(32), VarLenBytesCodec);
// 32 byte preimage-hash => blob
export const PreimagePairListCodec  = PairListCodec(Bytes(32), VarLenBytesCodec);
// u32 lookup-index => 32byte root
export const LookupPairListCodec    = PairListCodec(u32, Bytes(32));

export const ServiceInnerDataCodec: Codec<ServiceInnerData> = Struct({
  storage   : StoragePairListCodec,
  preimages : PreimagePairListCodec,
  lookup    : LookupPairListCodec,
});


export const ServiceAccountHeaderCodec: Codec<ServiceAccountHeader> = Struct({
  code_hash: Bytes(32),
  balance  : u64,
});


export const ServiceAccountCodec: Codec<ServiceAccount> = Struct({
  header: ServiceAccountHeaderCodec,
  data  : ServiceInnerDataCodec,
});


// const servicesMap = new Map<number, ServiceAccount>(servicesArray);
