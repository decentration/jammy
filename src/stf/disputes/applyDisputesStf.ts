import { DisputesState, DisputesInput, DisputesOutput, ErrorCode } from "./types";
import { arrayEqual, toHex } from "../../utils";
import { buildDisputeMessageFault, verifyDisputeSignature } from "./signature/verifyDisputesSignature";
import { whichValidatorSet } from "./validatorsSetSelector";
import { isSortedAndUniqueByReportHash, isSortedAndUniqueByValidatorKey, isSortedAndUniqueByVoteIndex } from "./utils/sortingChecks";
import { VALIDATOR_COUNT } from "../../consts";
import { buildDisputeMessageCulprit, buildDisputeMessageVerdict } from "./signature/verifyDisputesSignature";
import { hashInArray } from "./utils";

/**
 * applyDisputesStf
 * 
 * Implements GP section 10 logic for disputes. 
 * The input includes a set of:
 *   - verdicts (2/3+1 or 0 or 1/3 judgments on a given "target"),
 *   - culprits (validators that incorrectly guaranteed a now bad report),
 *   - faults" (validators signing contradictory or invalid judgments).
 *
 * We do the following:
 *  1. Check sorting & uniqueness constraints: verdicts by report-hash,
 *     culprits/faults by Ed25519 key, judgments within each verdict by
 *     validator index.
 *  2. Verify signature constraints: each vote must come from `kappa`
 *     or `lambda` set, matching the "age" or epoch index in the
 *     verdict. (10.3)
 *  3. Determine classification of each verdict's target as, good, bad, wonky:
 *       - "good" (2/3+1 positive votes),
 *       - "bad" (0 positives), or
 *       - "wonky" (1/3 exactly).
 *     and add them to `psi` => `psi.good`, `psi.bad`, or `psi.wonky`.
 *  4. Check the "offenders" sets from `culprits` & `faults` and ensure:
 *       - they reference the newly "bad" or "good" target appropriately,
 *       - they are not already in `psi.offenders`,
 *       - their signatures are correct, referencing either the "guarantee" or "contradiction" statement.
 *  5. Clear out any newly "bad" or "wonky" assignments from the `rho` array
 *     (10.15).
 *  6. Append new offenders to `psi.offenders`.
 *  7. Return `output` with newly discovered offenders (10.20).
 */
export function applyDisputesStf(
  preState: DisputesState,
  input: DisputesInput
): { output: DisputesOutput; postState: DisputesState } {

  const postState = structuredClone(preState) as DisputesState;
  const { verdicts, culprits, faults } = input.disputes;
  const { good, bad, wonky, offenders } = postState.psi;

  const newlyGood: Uint8Array[] = [];
  const newlyBad: Uint8Array[] = [];
  const newlyWonky: Uint8Array[] = [];
  const newOffenders: Uint8Array[] = [];

  const TWO_THIRDS_PLUS_ONE = Math.floor((VALIDATOR_COUNT * 2) / 3) + 1;
  const ONE_THIRD = Math.floor(VALIDATOR_COUNT / 3);

    // 1) Check sorting and uniqueness constraints
  if (!isSortedAndUniqueByReportHash(verdicts)) {
    return {
      output: { err: ErrorCode.VERDICTS_NOT_SORTED_UNIQUE },
      postState: preState,
    };
  }

  if (!isSortedAndUniqueByValidatorKey(culprits)) {
    return {
      output: { err: ErrorCode.CULPRITS_NOT_SORTED_UNIQUE },
      postState: preState,
    };
  }

  console.log("Culprits sorted and unique, here is faults", faults);
  // (c) Faults must be sorted by their key, no duplicates
  if (!isSortedAndUniqueByValidatorKey(faults)) {
    console.log("Faults not sorted or unique");
    return {
      output: { err: ErrorCode.FAULTS_NOT_SORTED_UNIQUE },
      postState: preState,
    };
  }


  // 2) For each verdict, check:
  //    - no re-judging an already judged item
  //    - sorted judgments
  //    - signature checks
  //    - classification (0 => bad, 2/3+1 => good, 1/3 => wonky, else => error)
  //    - if good => must be at least one fault referencing it
  //    - if bad => must be at least two culprits referencing it
  for (let coreIndex = 0; coreIndex < verdicts.length; coreIndex++) {
    const verdict = verdicts[coreIndex];

    const { target, age, votes } = verdict;

    // (i) No re-judging an already judged item
    if (hashInArray(target, good) || hashInArray(target, bad) || hashInArray(target, wonky)) {
      return {
        output: { err: ErrorCode.ALREADY_JUDGED },
        postState: preState,
      };
    }

    // ii) Sorted judgments
    if (!isSortedAndUniqueByVoteIndex(votes)) {
      return {
        output: { err: ErrorCode.JUDGEMENTS_NOT_SORTED_UNIQUE },
        postState: preState,
      };
    }

    let totalTrue = 0;

    // (iii) Signature checks
    const chosen = whichValidatorSet(verdict.age, postState);
    if (!chosen) {
      return {
        output: { err: ErrorCode.BAD_JUDGEMENT_AGE },
        postState: preState,
      };
    }
    const { validatorSet, validatorSource } = chosen;

    for (const j of votes) {
      if (j.vote) totalTrue += 1;

      // Range check
      if (j.index < 0 || j.index >= validatorSet.length) {
        return {
          output: { err: ErrorCode.BAD_VALIDATOR_INDEX },
          postState: preState,
        };
      }
  
      const pubEdKey = validatorSet[j.index].ed25519;

      // jam_valid or jam_invalid + target
      const message = buildDisputeMessageVerdict(target, j.vote);

      const isOk = verifyDisputeSignature(message, j.signature, pubEdKey);
      console.log("The signature is valid VERDICTS", isOk);

      if (!isOk) {
        return {
          output: { err: ErrorCode.BAD_SIGNATURE },
          postState: preState,
        };
      }
    
    }

    // (iv) Classification by number of true votes
    let classification: "good" | "bad" | "wonky" | null = null;

    if (totalTrue >= TWO_THIRDS_PLUS_ONE) {
      classification = "good";
    } else if (totalTrue === 0) {
      classification = "bad";
    } else if (totalTrue === ONE_THIRD) {
      classification = "wonky";
    } else {
      return {
        output: { err: ErrorCode.BAD_VOTE_SPLIT },
        postState: preState,
      };
    }

    // (v) if classification =good => must have at least one matching fault
    if (classification === "good") {
      const matchingFault = faults.find((f) => arrayEqual(f.target, target));
      if (!matchingFault) {
        return {
          output: { err: ErrorCode.NOT_ENOUGH_FAULTS },
          postState: preState,
        };
      }
    }
    // (v) if classification=bad => must have at least two matching culprits
    if (classification === "bad") {
      const matchingCulprits = culprits.filter((c) => arrayEqual(c.target, target));
      if (matchingCulprits.length < 2) {
        return {
          output: { err: ErrorCode.NOT_ENOUGH_CULPRITS },
          postState: preState,
        };
      }
    }

    // (g) record the classification
    if (classification === "good") newlyGood.push(target);
    if (classification === "bad") newlyBad.push(target);
    if (classification === "wonky") newlyWonky.push(target);

    // h) “Invalidate” occupant of this core in postState.rho
    //    2 scenarios:
    //      - occupant hash is the same => it is removed if verdict = “bad” or “wonky”
    //      - occupant hash is different => it is removed if verdict = “good”
    const occupant = postState.rho[coreIndex];
    if (occupant) {
      const occupantHash = occupant.report.package_spec.hash;
      const isSameHash = arrayEqual(occupantHash, target);

      if (classification === "bad" || classification === "wonky") {
        // if occupant has the same hash as the new bad/wonky, remove it
        if (isSameHash) {
          postState.rho[coreIndex] = null;
        }
      } else if (classification === "good") {
        // if occupant is a different hash than the new good, remove it
        if (!isSameHash) {
          postState.rho[coreIndex] = null;
        }
      }
    }
   
  };


  // 3) Check culprits => must reference a newlyBad target
  //    and must have a valid signature, must not be in offenders
  for (const c of culprits) {
    const { target, key, signature } = c;

    if (!hashInArray(target, newlyBad)) {
      // This culprit does not reference a newly “bad” target => error
      return {
        output: { err: ErrorCode.CULPRITS_VERDICT_NOT_BAD },
        postState: preState,
      };
    }

    if (hashInArray(key, offenders)) {
      // This key is already in the punish set
      return {
        output: { err: ErrorCode.OFFENDER_ALREADY_REPORTED },
        postState: preState,
      };
    }


    const pubEdKey = key;

    // jam_guarantee + target
    const message = buildDisputeMessageCulprit(target);
    const isOk = verifyDisputeSignature(message, signature, pubEdKey);
    console.log("The signature is valid CULPRITS", isOk);

    if (!isOk) {
      return {
        output: { err: ErrorCode.BAD_SIGNATURE },
        postState: preState,
      };
    }
    
    newOffenders.push(key);
  }


  // 4) Check faults => if referencing a newlyGood target => must have false vote
  //    or if referencing a newlyBad target => it might be contradictory...
  //    Then we do the same signature checks, ensure not already in offenders.
  for (const f of faults) {
    const { target, vote, key, signature } = f;

    // if referencing a newlyGood then the fault vote is presumably false
    if (hashInArray(target, newlyGood) && vote !== false) {
      return {
        output: { err: ErrorCode.FAULT_VERDICT_WRONG },
        postState: preState,
      };
    }

    // if referencing newlyBad => typically the fault’s vote might have been “true” => contradictory
    if (hashInArray(key, offenders)) {
      return {
        output: { err: ErrorCode.OFFENDER_ALREADY_REPORTED },
        postState: preState,
      };
    }

    // signature check for faults
    const pubEdKey = key; 

    const message = buildDisputeMessageFault(target, vote);
    if (!verifyDisputeSignature(message, signature, pubEdKey)) {
      console.log("The signature is not valid FAULTS");
      return {
        output: { err: ErrorCode.BAD_SIGNATURE },
        postState: preState,
      };
    }

    newOffenders.push(key);
  }

  // 5) Add newly good/bad/wonky to psi
  good.push(...newlyGood);
  bad.push(...newlyBad);
  wonky.push(...newlyWonky);


 // 6) Insert new offenders that arent already in the array => postState.psi.offenders
const uniqueNewOffenders: Uint8Array[] = [];
for (const k of newOffenders) {
  // we will only include if not already in the old set
  if (!hashInArray(k, offenders) && !hashInArray(k, uniqueNewOffenders)) {
    uniqueNewOffenders.push(k);
  }
}

offenders.push(...uniqueNewOffenders);
offenders.sort((a, b) => toHex(a).localeCompare(toHex(b)));

const output: DisputesOutput = {
  ok: {
    offenders_mark: uniqueNewOffenders,
  },
};

return { output, postState };
}


