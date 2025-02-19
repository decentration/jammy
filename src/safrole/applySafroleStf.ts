import { SafroleState, SafroleInput, SafroleOutput, ErrorCode, EpochMark } from "./types";
import { TicketsMark } from "../types/types";
import { toHex } from "../utils";
import { blake2bConcat } from "./helpers";


export function applySafroleStf(
  preState: SafroleState,
  input: SafroleInput
): { output: SafroleOutput; postState: SafroleState } {
  // 0) clone state
  const postState: SafroleState = structuredClone(preState);

  // 1) check slot progression
  if (input.slot <= preState.tau) {
    return { output: { err: ErrorCode.BAD_SLOT }, postState: preState };
  }

  // 2) tau
  postState.tau = input.slot;

  // 3) Update primary entropy accumulator
  // (6.22): η'[0] = H(η[0] || input.entropy)
  const oldEta0 = preState.eta[0];
  postState.eta[0] = blake2bConcat(oldEta0, input.entropy);
  console.log("eta[0]", postState.eta[0]);

  // TODO: Epoch and sub-epoch calculations
  // TODO: calculate oldEpoch and newEpoch as floor(slot/EPOCH_LENGTH)
  // TODO: calculate oldSubEpoch and newSubEpoch as floor((slot % EPOCH_LENGTH) / ROTATION_PERIOD)

  let epochMark: EpochMark | null = null;

  // TODO: Epoch boundary rotation
  // TODO: (6.23): Rotate entropy values: (η'[1], η'[2], η'[3]) = (η[0], η[1], η[2])
  // TODO (6.13): Rotate key sets (gamma_k, kappa, lambda, iota)
  // TODO: (6.34): check if we need to reset the ticket accumulator (gamma_a)
  // TODO:  (6.24): check confition to rebuild gamma_s

  // TODO: process extrinsic tickets
  // TODO: Process extrinsic tickets, attempt checks, duplicate detection, appending to gamma_a

  const usedTicketIds = new Set<string>();
  for (const ticketEnv of input.extrinsic) {
    if (ticketEnv.attempt > 255) {
      return { output: { err: ErrorCode.BAD_TICKET_ATTEMPT }, postState: preState };
    }
    const ticketHex = toHex(ticketEnv.signature);
    if (usedTicketIds.has(ticketHex)) {
      return { output: { err: ErrorCode.DUPLICATE_TICKET }, postState: preState };
    }
    usedTicketIds.add(ticketHex);
    const newMark: TicketsMark = {
      id: ticketEnv.signature.slice(0, 32),
      attempt: ticketEnv.attempt,
    };
    postState.gamma_a.push(newMark);
  }

  // 6) Output
  const output: SafroleOutput = {
    ok: {
      epoch_mark: epochMark,
      tickets_mark: null,
    },
  };

  // 7) return output and postState
  return { output, postState };
}
