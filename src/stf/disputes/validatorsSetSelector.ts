import { EPOCH_LENGTH } from "../../consts";
import { ValidatorInfo } from "../types";
import { DisputesState } from "./types";

export function whichValidatorSet(
  verdictEpoch: number,
  state: DisputesState,
): { validatorSet: ValidatorInfo[]; validatorSource: "curr" | "prev" } | null {
  // 1) derive epoch index from block/slot number tau
  const currentEpochIndex = Math.floor(state.tau / EPOCH_LENGTH);

  // 2) Compare the verdict’s "age" with the currentEpochIndex
  if (verdictEpoch === currentEpochIndex) {
    // same epoch => use kappa
    return {
      validatorSet: state.kappa,
      validatorSource: "curr",
    };
  } else if (verdictEpoch === currentEpochIndex - 1) {
    // previous epoch, lambda
    return {
      validatorSet: state.lambda,
      validatorSource: "prev",
    };
  }

  // 3) Otherwise => output “bad_judgement_age”
  return null;
}