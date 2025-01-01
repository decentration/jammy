import { Struct, Bytes, u32, Codec, _void } from 'scale-ts';
export interface WorkPackage {
  hash: Uint8Array;        // Bytes(32)
  exports_root: Uint8Array; // Bytes(32)
}

export interface HistoryInput {
  header_hash: Uint8Array;        // Bytes(32)
  parent_state_root: Uint8Array;  // Bytes(32)
  accumulate_root: Uint8Array;    // Bytes(32)
  work_packages: WorkPackage[];
}

export type MMRPeak = Uint8Array | null; // Bytes(32) | null    
export interface MMR {
  peaks: MMRPeak[]; // array of Bytes(32)
}

export interface BetaItem {
    header_hash: Uint8Array; 
    mmr: MMR;                // { peaks: (Uint8Array|null)[] }
    state_root: Uint8Array; 
    reported: WorkPackage[]; 
}

export interface PreState {
  beta: BetaItem[];
}
export interface PostState {
  beta: BetaItem[];
}

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

