import { ValidatorInfo, AssurancesInput, Output } from "../types";
import { BITFIELD_LENGTH } from "../../consts";
import { Struct, Bytes } from "scale-ts";
import { AvailAssignment } from "../../types/types";

export interface AssuranceState {
  avail_assignments: (AvailAssignment | null)[]; 
  curr_validators: ValidatorInfo[];
}

export interface Assurances {
  input: AssurancesInput;            
  pre_state: AssuranceState;
  output: Output;              
  post_state: AssuranceState; 
}

export interface PreAndPostState {
  pre_state: AssuranceState;
  post_state: AssuranceState;
}


export interface SignatureInput {
  anchor: Uint8Array; // 32 bytes
  bitfield: Uint8Array; // BITFIELD_LENGTH bytes
}

// these are the parts of the signature that are hashed, and then the XA is also concatenated at the beginning
export const SignatureInputCodec = Struct({
  anchor: Bytes(32),              // 32-byte parent hash
  bitfield: Bytes(BITFIELD_LENGTH), // Fixed-size bitfield (1 byte for tiny)
});