import { toBytes } from "../../codecs";
import { Report } from "../../types/types";
import { State as AssurancesState } from "./types";
import { TIMESLOT_DELAY_PERIOD } from "../../consts";

export function areSortedAndUniqueByValidatorIndex(assurances: {
    validator_index: number;
  }[]): boolean {
    for (let i = 0; i < assurances.length - 1; i++) {
      if (assurances[i].validator_index >= assurances[i + 1].validator_index) {
        return false;
      }
    }
    return true;
  }



  export function handleStaleAssignments(
    postState: AssurancesState,
    currentSlot: number,
  ): void {
    for (let c = 0; c <= postState.avail_assignments.length; c++) {
      const assignment = postState.avail_assignments[c];
      if (!assignment) continue;
  
      if (currentSlot >= assignment.timeout + TIMESLOT_DELAY_PERIOD) {
        console.log("Stale assignment", { c, currentSlot, assignment });
        // This is stale => eq. 11.17 => remove it => push to reported
        // reported.push(assignment.report);
        postState.avail_assignments[c] = null;
      }
    }
  }


/** 
 * finalizeTwoThirds:
 *  1) Count how many validators assured each core
 *  2) if count > floor(2/3 * validatorCount) => remove => push report => reported
 */
export function finalizeTwoThirds(
  postState: AssurancesState,
  assurances: { bitfield: Uint8Array; validator_index: number }[],
  reported: Report[]
) {
  const validatorCount = postState.curr_validators.length;
  const coreCount = postState.avail_assignments.length;
  const threshold = Math.floor((2 * validatorCount) / 3);

  const countAssurersPerCore = new Array(coreCount).fill(0);

  for (const a of assurances) {
    const bitfield = toBytes(a.bitfield);
    console.log("bitfield", {a, bitfield});
    for (let byteIndex = 0; byteIndex < bitfield.length; byteIndex++) {
      const byteVal = bitfield[byteIndex];
      for (let bitPos = 0; bitPos < 8; bitPos++) {
        if (((byteVal >> bitPos) & 1) === 1) {
          console.log("bit set", {byteIndex, bitPos});
          const coreIndex = byteIndex * 8 + bitPos;
          if (coreIndex < coreCount && postState.avail_assignments[coreIndex]) {
            countAssurersPerCore[coreIndex]++;
          }
        }
      }
    }
  }

  console.log("countAssurersPerCore:", countAssurersPerCore, "threshold:", threshold);

  // now remove
  for (let c = 0; c < coreCount; c++) {
    if (postState.avail_assignments[c]) {
      if (countAssurersPerCore[c] > threshold) {
      //finalize => remove => push to reported
      const assignment = postState.avail_assignments[c];
      if (assignment) {
        // assignment is known to be non-null inside this block
        reported.push(assignment.report);
        postState.avail_assignments[c] = null;
      }
    }
  }
}};


