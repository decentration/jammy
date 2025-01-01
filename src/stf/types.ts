import { Struct, Bytes, u32, Codec, _void } from 'scale-ts';
import { DiscriminatorCodec } from '../codecs/DiscriminatorCodec';

export interface WorkPackage {
  hash: Uint8Array;        // Bytes(32)
  exports_root: Uint8Array; // Bytes(32)
}

export const WorkPackageCodec = Struct({
  hash: Bytes(32),
  exports_root: Bytes(32),
});

export const WorkPackagesCodec = DiscriminatorCodec(WorkPackageCodec);


export interface HistoryInput {
  header_hash: Uint8Array;        // Bytes(32)
  parent_state_root: Uint8Array;  // Bytes(32)
  accumulate_root: Uint8Array;    // Bytes(32)
  work_packages: WorkPackage[];
}

export const InputCodec = Struct({
  header_hash: Bytes(32),
  parent_state_root: Bytes(32),
  accumulate_root: Bytes(32),
  work_packages: WorkPackagesCodec,
});


export interface MMR {
  peaks: Uint8Array[]; // array of Bytes(32)
}

export const MMRCodec = Struct({
  peaks: DiscriminatorCodec(Bytes(32)),
});



export interface BetaItem {
    header_hash: Uint8Array; 
    mmr: MMR;                // { peaks: (Uint8Array|null)[] }
    state_root: Uint8Array; 
    reported: WorkPackage[]; 
  }

export const BetaItemCodec = Struct({
  header_hash: Bytes(32),
  mmr: MMRCodec,
  state_root: Bytes(32),
  reported: WorkPackagesCodec, // same shape as “work_packages” from input
});

export interface PreState {
  beta: BetaItem[];
}

export const PreStateCodec = Struct({
  beta: DiscriminatorCodec(BetaItemCodec),
});

export interface PostState {
  beta: BetaItem[];
}

export const PostStateCodec = Struct({
  beta: DiscriminatorCodec(BetaItemCodec),
});


 // placeholder
export const OutputCodec: Codec<null> = [
  () => new Uint8Array(0),
  () => null,             
] as unknown as Codec<null>;
OutputCodec.enc = () => new Uint8Array(0);
OutputCodec.dec = () => null;

export interface History {
  input: HistoryInput;
  pre_state: PreState;
  output: null;       
  post_state: PostState;
}

