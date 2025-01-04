import { Struct, Bytes, u32, Codec, _void } from 'scale-ts';
import { Report, Assurance, BandersnatchPublic, Ed25519Public, BlsPublic, ValidatorMetadata} from '../types/types';
import { PreAndPostState } from './assurances/types';
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

export interface ValidatorInfo {
    bandersnatch: BandersnatchPublic; // Bytes(32)
    ed25519: Ed25519Public;     // Bytes(32)
    bls: BlsPublic;         // Bytes(144)
    metadata: ValidatorMetadata;    // Bytes(128)
 }

export interface AvailAssignment {
    report: Report;
    timeout: number; // 4 bytes
  }
  


  export interface Input {
    assurances: Assurance[];     // No length prefix, strict order
    slot: number;                // 4 bytes, LE
    parent: Uint8Array;          // 32 bytes
  } 

  export interface Output {
    status: number;
    subcode: ErrorCode;
  }
  export interface Assurances {
    input: Input;            
    pre_state: PreAndPostState;
    output: Output | null;              
    post_state: PreAndPostState; 
  }


  export enum ErrorCode {
    BAD_ATTESTATION_PARENT = 0,
    BAD_VALIDATOR_INDEX = 1,
    CORE_NOT_ENGAGED = 2,
    BAD_SIGNATURE = 3,
    NOT_SORTED_OR_UNIQUE_ASSURERS = 4,
  }


  export enum subcode {
    OK = 0,
    ERR = 1,
  }