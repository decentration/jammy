import { State as AssurancesState } from "./types";
import { AssurancesInput, Output, ErrorCode } from "../types";
import { areSortedAndUniqueByValidatorIndex, handleStaleAssignments, finalizeTwoThirds} from "./helpers";
import { arrayEqual } from "../../utils";
import { Report } from "../../types/types";
import { validateAssurances } from "./validateAssurances";

/**
 * applyAssurancesStf implements the logic from section 11 of the Jam paper:
 * 
 *  - The extrinsic EA (equation 11.10) is a sequence of "assurances," each of which:
 *    - must be anchored to the parent Hp (11.11)
 *    - must be sorted by validator_index (11.12)
 *    - must have a valid signature over (Hp, bitfield) (11.13)
 *    - must only set bits for cores that actually have a pending assignment (11.15)  
 *    - the applyAssurancesStf function:
 *      - Clones preState => postState
 *      - Applies the validations from 11.10 - 11.15
 *      - Checks for 2/3 majority availability per 11.16
 *      - If any condition fails => return an error code.
 *      - Returns { output, postState }
 */
export async function applyAssurancesStf(
  preState: AssurancesState,
  input: AssurancesInput
): Promise<{ output: Output; postState: AssurancesState; }> {
  // 1) clone preState => postState
  const postState = structuredClone(preState);

  const reported: Report[] = [];

  // 1) Validate the “assurances” array
  if (input.assurances.length === 0) {

    // also check for stale assignments
    handleStaleAssignments(postState, input.slot);

    return { output: { ok: { reported } }, postState };
  }

  // 2) Check validator_index in range => part of eq. 11.10 (v ∈ Nᵥ => must be < #validators)
  for (const assurance of input.assurances) {
    if (assurance.validator_index >= postState.curr_validators.length) {
      return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState };
    }
  }

  // 3) For each assurance a => implement eq. 11.11, 11.13, 11.15, etc.
  // 11.12 => assurances must be sorted by validator_index (and uniqueness)
  // move this out, dont need to check through each loop...
  if (!areSortedAndUniqueByValidatorIndex(input.assurances)) {
    return {
      output: { err: ErrorCode.NOT_SORTED_OR_UNIQUE_ASSURERS },
      postState,
    };
  }

  // 4) For each assurance a => implement eq. 11.11, 11.13, 11.15, etc.
  const errorCode = await validateAssurances(postState, input);
  if (errorCode) {
    return { output: { err: errorCode }, postState };
  }

  // 5) aggregator => eq. 11.16 => if > 2/3 => finalize, and push to reported. 
  const assurancesForFinalization = input.assurances.map(a => ({
    // direct
    bitfield: a.bitfield,
    validator_index: a.validator_index,
  }));
  finalizeTwoThirds(postState, assurancesForFinalization, reported);

  // 6) Check for stale => eq. 11.17
  // If stale, we remove the assignment
  handleStaleAssignments(postState, input.slot);

  // 7) If all is well, either produce output: null or { ok: ... } 
  return { output: { ok: { reported } }, postState };
}



