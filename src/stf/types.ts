import { Struct, Bytes, u32, Codec, _void } from 'scale-ts';
import { Report, Assurance, BandersnatchPublic, Ed25519Public, BlsPublic, ValidatorMetadata} from '../types/types';

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

export interface State {
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
  pre_state: State;
  output: null;       
  post_state: State;
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
  
  export type AssurancesExtrinsic = Assurance[];


  export interface AssurancesInput {
    assurances: AssurancesExtrinsic;  // Sequence of Assurance
    slot: number;                // 4 bytes, LE
    parent: Uint8Array;          // 32 bytes
  } 


  export type Output = { err: ErrorCode }| { ok: OkData } | null;
  

  export interface OkData {
    reported: Report[];
  }



  export enum ErrorCode {
    BAD_ATTESTATION_PARENT = "bad_attestation_parent",
    BAD_VALIDATOR_INDEX = "bad_validator_index",
    CORE_NOT_ENGAGED = "core_not_engaged",
    BAD_SIGNATURE = "bad_signature",
    NOT_SORTED_OR_UNIQUE_ASSURERS = "not_sorted_or_unique_assurers",
  }


  export enum Status {
    OK = 0,
    ERR = 1,
  }