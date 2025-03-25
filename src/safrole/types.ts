import { u32 } from "scale-ts";
import { ValidatorInfo } from '../stf/types';
import { BandersnatchRingVrfSignature, BandersnatchPublic, Ed25519PublicCodec, TicketsMark, BandersnatchRingRoot, Ed25519Public } from '../types/types';
import { DiscriminatorCodec } from "../codecs";

export const TimeSlotCodec = u32;

// ticket or kets is either 12 TicketsMark or 12 32-byte keys 
export type TicketsOrKeys =
  | { tickets: TicketsMark[] }  // EXACTLY 12 TicketsMark which is 33 bytes each
  | { keys: BandersnatchPublic[] };    // EXACTLY 12 32-byte keys 
  
export const PostOffendersCodec = DiscriminatorCodec(Ed25519PublicCodec);

export interface SafroleState {
  tau: number; // TimeSlot = u32
  eta: Uint8Array[]; // EntropyBuffer => exactly 4 x 32 bytes
  lambda: ValidatorInfo[];
  kappa: ValidatorInfo[];
  gamma_k: ValidatorInfo[];
  iota: ValidatorInfo[];
  gamma_a: TicketsMark[];  // can be empty 
  gamma_s: TicketsOrKeys; // tickets or keys => 12 x 32 bytes
  gamma_z: BandersnatchRingRoot;   // 144 bytes
  post_offenders: Uint8Array[]; // sequence of Ed25519Public => array of 32
}

export interface SafroleInput {
  // 32-bit number --> TimeSlot
  slot: number;

  // a 32-byte random seed
  entropy: Uint8Array;
  extrinsic: TicketEnvelope[]; 
}

/**
 * TicketEnvelope = { attempt(U8), signature(BandersnatchRingVrfSignature) }
 */
export interface TicketEnvelope {
  attempt: number; // 1 byte
  signature: BandersnatchRingVrfSignature; 
}


export type { TicketsMark } from "../types/types";


export type SafroleOutput = 
  | { err: ErrorCode }
  | { ok: OkData };

export interface OkData {
  epoch_mark: EpochMark | null;
  tickets_mark: TicketsMark[] | null;
}

// export enum ErrorCode {
//   bad_slot = 0,
//   unexpected_ticket = 1,
//   bad_ticket_order = 2,
//   bad_ticket_proof = 3,
//   bad_ticket_attempt = 4,
//   reserved = 5,
//   duplicate_ticket = 6
// }

export enum ErrorCode {
  BAD_SLOT = "bad_slot",  
  UNEXPECTED_TICKET = "unexpected_ticket",
  BAD_TICKET_ORDER = "bad_ticket_order",
  BAD_TICKET_PROOF = "bad_ticket_proof",
  BAD_TICKET_ATTEMPT = "bad_ticket_attempt",
  RESERVED = "reserved",
  DUPLICATE_TICKET = "duplicate_ticket"
}

export const SAFROLE_ERROR_CODES: ErrorCode[] = [
  ErrorCode.BAD_SLOT,
  ErrorCode.UNEXPECTED_TICKET,
  ErrorCode.BAD_TICKET_ORDER,
  ErrorCode.BAD_TICKET_PROOF,
  ErrorCode.BAD_TICKET_ATTEMPT,
  ErrorCode.RESERVED,
  ErrorCode.DUPLICATE_TICKET
]


export interface ValidatorsEpochMark {
  bandersnatch: BandersnatchPublic; // Bytes(32)
  ed25519: Ed25519Public;     // Bytes(32)
}

export interface EpochMark {
  entropy: Uint8Array;          // 32 bytes
  tickets_entropy: Uint8Array;  // 32 bytes
  validators: ValidatorsEpochMark[];  // 32 bytes each     
}

export interface SafroleStf {
  input: SafroleInput;
  pre_state: SafroleState;
  output: SafroleOutput;       
  post_state: SafroleState;
}


// from verifyTicketSignature function
export interface TicketVerifyContext {
  ringKeysStr: string;      // space-separated bandersnatch pubkeys in hex
  entropy2: string;         // eta[2] in hex
  attempt: number;         
}

export interface VerifyTicketOutput {
  ok: boolean;
  vrfOutput: Uint8Array;
}