import { toBytes } from "../../codecs";
import { State as AssurancesState } from "./types";
import { AssurancesInput, ErrorCode } from "../types";
import { arrayEqual } from "./helpers";
import { verifyAssuranceSignature } from "./verifyAssuranceSignature";

export async function validateAssurances(postState: AssurancesState, input: AssurancesInput): Promise<ErrorCode | null> {

    const coreCount = postState.avail_assignments.length;

    for (const assurance of input.assurances) {
  
        // 4a) 11.11 => anchor must match parent. need to confirm anchor == input.parent
        if (!arrayEqual(assurance.anchor, input.parent)) {
          return ErrorCode.BAD_ATTESTATION_PARENT;
        }
        
        // 4b) 11.13 => signature check
        const anchor = toBytes(assurance.anchor);
        const bitfield = toBytes(assurance.bitfield);
        const signature = toBytes(assurance.signature);
        const ed25519Pub = toBytes(postState.curr_validators[assurance.validator_index].ed25519);
  
        const isValid = await verifyAssuranceSignature(anchor, bitfield, signature, ed25519Pub);
        console.log("Is signature valid =>", isValid);
  
        if (!isValid) {
          return ErrorCode.BAD_SIGNATURE;
        }
  
        // 4c) 11.15 => bits must only be set for cores that have a pending assignment
        for (let byteIndex = 0; byteIndex < bitfield.length; byteIndex++) {
          // loop over bits
          const byteVal = bitfield[byteIndex];
          for (let bitPos = 0; bitPos < 8; bitPos++) {
              // Check if the bit is set
              const isSet = ((byteVal >> bitPos) & 1) === 1;
              if (isSet) {
              const coreIndex = byteIndex * 8 + bitPos;
              // If we exceed the length, that might be an error or we ignore
              if (coreIndex >= coreCount) {
                  // throw an error if the bit references a non-existent core
                  return ErrorCode.CORE_NOT_ENGAGED;
              }
              // If there's no assignment => "core_not_engaged"
              if (!postState.avail_assignments[coreIndex]) {
                  return ErrorCode.CORE_NOT_ENGAGED;
              }
            }
        }
      }
    }
    return null;
    }