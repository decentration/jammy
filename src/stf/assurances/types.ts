import { AvailAssignment, ValidatorInfo } from "../types";

export interface PreAndPostState {
  avail_assignments: (AvailAssignment | null)[]; 
  curr_validators: ValidatorInfo[];
}