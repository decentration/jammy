import { AvailAssignment, ValidatorInfo, AssurancesInput, Output } from "../types";

export interface State {
  avail_assignments: (AvailAssignment | null)[]; 
  curr_validators: ValidatorInfo[];
}

export interface Assurances {
  input: AssurancesInput;            
  pre_state: State;
  output: Output;              
  post_state: State; 
}

export interface PreAndPostState {
  pre_state: State;
  post_state: State;
}