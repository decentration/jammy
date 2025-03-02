import { SafroleState, SafroleInput, SafroleOutput, ErrorCode, EpochMark } from "./types";
import { TicketsMark } from "../types/types";
import { convertToReadableFormat, toHex } from "../utils";
import { blake2bConcat, zeroOutOffenders } from "./helpers";
import { EPOCH_LENGTH } from "../consts";
import { rebuildGammaSForEpochChange } from "./gamma";
import { computeGammaZ, produceGammaZ } from "./computeGammaZ";
import { aggregator } from "../ring-vrf-ffi/ring_vrf_ffi"


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

  // (3) Update primary entropy accumulator
  // (6.22): η'[0] = H(η[0] || input.entropy)
  // Save pre‐rotation entropy values for later use in the rotation.
  const preEta0 = preState.eta[0];
  const preEta1 = preState.eta[1];
  const preEta2 = preState.eta[2];

  console.log("inputEntropy", preEta0, input.entropy);
  postState.eta[0] = blake2bConcat(preEta0, input.entropy);
  console.log("eta[0]", postState.eta[0]);

  // TODO: Epoch and sub-epoch calculations
    // (4) Calculate epoch and sub‐epoch indices.
  // TODO [Timekeeping, Eq. (6.2)]
  const oldEpoch    = Math.floor(preState.tau / EPOCH_LENGTH);
  const newEpoch    = Math.floor(input.slot / EPOCH_LENGTH);
  
  // TODO: calculate oldSubEpoch and newSubEpoch as floor((slot % EPOCH_LENGTH) / ROTATION_PERIOD)

  let epochMark: EpochMark | null = null;

  // TODO: Epoch boundary rotation
  // TODO: (6.23): Rotate entropy values: (η'[1], η'[2], η'[3]) = (η[0], η[1], η[2])
  // TODO (6.13): Rotate key sets (gamma_k, kappa, lambda, iota)
  // TODO: (6.34): check if we need to reset the ticket accumulator (gamma_a)
  // TODO:  (6.24): check confition to rebuild gamma_s
  if (newEpoch > oldEpoch) {

    postState.eta[1] = preState.eta[0];
    postState.eta[2] = preState.eta[1];
    postState.eta[3] = preState.eta[2];
    postState.lambda  = preState.kappa; 
    postState.kappa   = preState.gamma_k; 
    postState.gamma_k = zeroOutOffenders(preState.iota, preState.post_offenders); 
    // iota no change
    postState.gamma_a = [];

    const justEndedEpoch = newEpoch === oldEpoch + 1;
    rebuildGammaSForEpochChange(postState, justEndedEpoch);
  
    // postState.gamma_z = ringRootOf(postState.gamma_k);

    const aggregatorSecret = preState.eta[2];
    console.log("aggregatorSecret", aggregatorSecret);

    const ringKeysStr = postState.gamma_k
      .map(validator => {
      // Convert the Uint8Array => hex string
      const hexPub = Buffer.from(validator.bandersnatch).toString("hex");
      return hexPub;
    }).join(" ");

    const ringSize    = postState.gamma_k.length;
    const srsPath     = "./ring-vrf/data/zcash-srs-2-11-uncompressed.bin";

    const aggregatorBytes = aggregator(ringKeysStr, ringSize, srsPath);
    postState.gamma_z = aggregatorBytes; 


    // post offenders no change...

// outpute
    epochMark = {
      entropy:        preState.eta[0],  // old "eta[0]" 
      tickets_entropy: preState.eta[1], // old "eta[1]"
      validators: postState.gamma_k.map(v => v.bandersnatch)
    };

  } else {
    postState.gamma_k = preState.gamma_k;
    postState.kappa   = preState.kappa;
    postState.lambda  = preState.lambda;
    postState.gamma_z = preState.gamma_z;
  }
  

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

  // console.log("output", convertToReadableFormat(output));

  // console.log("postState", convertToReadableFormat(postState));

  // 7) return output and postState
  return { output, postState };
}
