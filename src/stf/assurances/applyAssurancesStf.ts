import { State as AssurancesState } from "./types";
import { AssurancesInput, Output, ErrorCode } from "../types";

export function applyAssurancesStf(
  preState: AssurancesState,
  input: AssurancesInput
): { output: Output; postState: AssurancesState } {
  // 1) clone preState => postState
  const postState = structuredClone(preState);

  // TODO
  // 2) Validate the “assurances” array
  //    - Check if assurances are empty if they are then make Output ok reported, 
  //      like this: "output": { "ok": { "reported": []}},
  //    - Are they sorted by validator_index? (GP says must be)
  //    - Are they UNIQUE by validator_index? (GP says must be)
  //    - sorted but not contiguous
  //    - Check each signature is correct for anchor=parent + bitfield
  //    - Check no bit is set that references a core with no pending assignment
  //    - Possibly check “2/3 super-majority” logic => finalizing availability
  //    - If any check fails => produce e.g. { err: ErrorCode.BAD_SIGNATURE } or so.

 // For example, a simple scenario:
 // TODO
  if (!areSortedAndUniqueByValidatorIndex(input.assurances)) {
    return {
      output: { err: ErrorCode.NOT_SORTED_OR_UNIQUE_ASSURERS },
      postState,
    };
  }

  // If some core is "not engaged" => { err: ErrorCode.CORE_NOT_ENGAGED }

  // etc. Possibly “slot” logic => if slot < something?

  // 3) If no error => update postState if needed (like marking the assignment are assured)
  // e.g. if 2/3 majority => set the assignment to “available” or remove it, etc.
  
  // 4) If all is well, either produce output: null or { ok: ... } 
  return { output: null, postState };
}
