import { Ed25519Public, Ed25519Signature, OffendersMark, Report } from "../../types/types";
import { ValidatorInfo } from "../types";

export interface DisputesInput {
    disputes: DisputeExtrinsic;  // { verdicts, culprits, faults }
  }
  
export type DisputesOutput = { err: ErrorCode } | { ok: OkData } ;

export interface DisputesRecords {
  good: Uint8Array[];  
  bad: Uint8Array[];
  wonky: Uint8Array[];
  offenders: Ed25519Public[];
}

export interface DisputesState {
  psi: DisputesRecords;        // the disputes sets
  rho: (Assignment | null)[];  // availability assignment array
  tau: number;                 // last timeslot
  kappa: ValidatorInfo[];      // current epoch's validators
  lambda: ValidatorInfo[];     // previous epoch's validators
}

// The extrinsic:
export interface DisputeExtrinsic {
  verdicts: Verdict[];
  culprits: Culprit[];
  faults: Fault[];
}

export interface Verdict {
  target: Uint8Array;
  age: number;
  votes: Array<{
    vote: boolean;
    index: number;
    signature: Uint8Array;
  }>;
}

export interface Culprit {
  target: Uint8Array;
  key: Ed25519Public;  
  signature: Ed25519Signature; 
}

export interface Fault {
  target: Uint8Array;
  vote: boolean;
  key: Uint8Array;
  signature: Ed25519Signature;
}

export interface Assignment {
  report: Report;
  timeout: number;
}

export type Output = { err: ErrorCode } | { ok: OkData } | null; 

export interface OkData {
  offenders_mark: OffendersMark[];
}

export enum ErrorCode {
  ALREADY_JUDGED = "already_judged",
  BAD_VOTE_SPLIT = "bad_vote_split",
  VERDICTS_NOT_SORTED_UNIQUE = "verdicts_not_sorted_unique",
  JUDGEMENTS_NOT_SORTED_UNIQUE = "judgements_not_sorted_unique",
  CULPRITS_NOT_SORTED_UNIQUE = "culprits_not_sorted_unique",
  FAULTS_NOT_SORTED_UNIQUE = "faults_not_sorted_unique",
  NOT_ENOUGH_CULPRITS = "not_enough_culprits",
  NOT_ENOUGH_FAULTS = "not_enough_faults",
  FAULT_VERDICT_WRONG = "fault_verdict_wrong",
  CULPRITS_VERDICT_NOT_BAD = "culprits_verdict_not_bad",
  OFFENDER_ALREADY_REPORTED = "offender_already_reported",
  BAD_JUDGEMENT_AGE = "bad_judgement_age",
  BAD_VALIDATOR_INDEX = "bad_validator_index",
  BAD_SIGNATURE = "bad_signature",
}

export const DISPUTES_ERROR_CODES: ErrorCode[] = [
  ErrorCode.ALREADY_JUDGED,
  ErrorCode.BAD_VOTE_SPLIT,
  ErrorCode.VERDICTS_NOT_SORTED_UNIQUE,
  ErrorCode.JUDGEMENTS_NOT_SORTED_UNIQUE,
  ErrorCode.CULPRITS_NOT_SORTED_UNIQUE,
  ErrorCode.FAULTS_NOT_SORTED_UNIQUE,
  ErrorCode.NOT_ENOUGH_CULPRITS,
  ErrorCode.NOT_ENOUGH_FAULTS,
  ErrorCode.FAULT_VERDICT_WRONG,
  ErrorCode.CULPRITS_VERDICT_NOT_BAD,
  ErrorCode.OFFENDER_ALREADY_REPORTED,
  ErrorCode.BAD_JUDGEMENT_AGE,
  ErrorCode.BAD_VALIDATOR_INDEX,
  ErrorCode.BAD_SIGNATURE,
];


export interface Disputes {
  input: DisputesInput;
  pre_state: DisputesState; 
  output: DisputesOutput;
  post_state: DisputesState;
}
