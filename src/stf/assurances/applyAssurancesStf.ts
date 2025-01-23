import { State as AssurancesState } from "./types";
import { AssurancesInput, Output, ErrorCode } from "../types";
import { verifyAssuranceSignature } from "./verifyAssuranceSignature";
import { hexStringToBytes, toBytes } from "../../codecs";
import { InputCodec } from "./codecs/Input/InputCodec";
import { AssuranceCodec } from "./codecs/Input/AssuranceCodec";

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

  // TODO
  // 2) Validate the “assurances” array
  //    - Check if assurances are empty if they are then make Output ok reported, 
if (input.assurances.length === 0) {
    
    return { output: { ok: { reported: [] } }, postState };
}
  //      like this: "output": { "ok": { "reported": []}},
  //    - Are they sorted by validator_index? (GP says must be)
  //    - Are they UNIQUE by validator_index? (GP says must be)
  //    - sorted but not contiguous



  //    - Check each signature is correct for anchor=parent + bitfield
  //    - Check no bit is set that references a core with no pending assignment
  //    - Possibly check “2/3 super-majority” logic => finalizing availability
  //    - If any check fails => produce e.g. { err: ErrorCode.BAD_SIGNATURE } or so.



    // 4) For each assurance a => implement eq. 11.11, 11.13, 11.15, etc.
    for (const assurance of input.assurances) {

        // a) Check validator_index in range => part of eq. 11.10 (v ∈ Nᵥ => must be < #validators)
        if (assurance.validator_index >= postState.curr_validators.length) {
          return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState };
        }

          // 11.12 => assurances must be sorted by validator_index (and uniqueness)
        if (!areSortedAndUniqueByValidatorIndex(input.assurances)) {
          return {
            output: { err: ErrorCode.NOT_SORTED_OR_UNIQUE_ASSURERS },
            postState,
          };
        }

        
        // 11.11 => anchor must match parent. need to confirm anchor == input.parent
        //    if (!arrayEqual(assurance.anchor, input.parent)) {...}
        // 11.13 => signature check, bls is a TODO

        console.log("assurance", assurance);
        const anchor = toBytes(assurance.anchor);
        const bitfield = toBytes(assurance.bitfield);
        const signature = toBytes(assurance.signature);
        
        const publicKey = toBytes(postState.curr_validators[assurance.validator_index].ed25519);
        console.log("anchor, bitfield, signature, publicKey", { anchor, bitfield, signature, publicKey });
      
        const isValid = await verifyAssuranceSignature(anchor, bitfield, signature, publicKey);
        console.log("Is signature valid =>", isValid);

        if (!isValid) {
          return { output: { err: ErrorCode.BAD_SIGNATURE }, postState };
        }

        // 11.15 => bits must only be set for cores that have a pending assignment
    

    
        // b) Check signature => 11.13
        //    For M1, I am assuming we should do it because there is a conformance test for it. 
    
        console.log("assurance", assurance);
        // c) Check bitfield => 11.15 
        // basically, a byte in the bitfield represents 8 cores, bit[0] = core 0, bit[1] = core 1, etc. 
        // If the validator is claiming that c cores are engaged, then the bitfield should have c bits set. 
        // if not then return core_not_engaged. pre_state avail_assignments, with each assignment with a core index. 
        // if that index is not available, when the bitfield said it was then this is an error.
        // If the bit is set, the core is engaged.
        // loop over bytes
        for (let byteIndex = 0; byteIndex < bitfield.length; byteIndex++) {
        // loop over bits
        const byteVal = bitfield[byteIndex];
        for (let bitPos = 0; bitPos < 8; bitPos++) {
            // Check if the bit is set
            const isSet = ((byteVal >> bitPos) & 1) === 1;
            if (isSet) {
            const coreIndex = byteIndex * 8 + bitPos;
            // If we exceed the length, that might be an error or we ignore
            if (coreIndex >= postState.avail_assignments.length) {
                // throw an error if the bit references a non-existent core
                return { output: { err: ErrorCode.CORE_NOT_ENGAGED }, postState };
            }
            // If there's no assignment => "core_not_engaged"
            if (!postState.avail_assignments[coreIndex]) {
                return { output: { err: ErrorCode.CORE_NOT_ENGAGED }, postState };
            }
          }
        }
      }
    }


  // etc. Possibly slot logic => if slot < something?

  // 4) If no error => update postState if needed (like marking the assignment are assured)
  // e.g. if 2/3 majority => set the assignment to “available” or remove it, etc.
  
  // 5) If all is well, either produce output: null or { ok: ... } 
  return { output: null, postState };
}


function areSortedAndUniqueByValidatorIndex(assurances: {
    validator_index: number;
  }[]): boolean {
    for (let i = 0; i < assurances.length - 1; i++) {
      if (assurances[i].validator_index >= assurances[i + 1].validator_index) {
        return false;
      }
    }
    return true;
  }