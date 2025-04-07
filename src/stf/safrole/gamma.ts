import { blake2bConcat, zeroOutOffenders } from "./helpers"; 
import { SafroleState } from "./types";
import { CONTEST_DURATION, EPOCH_LENGTH } from "../../consts";
import { ValidatorInfo } from "../types";
import { BandersnatchPublic } from "../../types/types";
import { aggregator } from "../../ffi/ring-vrf-ffi/ring_vrf_ffi";

export function rebuildGammaSForEpochChange(
  oldState: SafroleState,
  newState: SafroleState,
  oldEpoch: number,
  newEpoch: number
): void {
  // 1) if we have no epoch change at all
  if (newEpoch === oldEpoch) {
    //  => Keep the old gamma_s
    newState.gamma_s = structuredClone(oldState.gamma_s);
    return;
  }

  // 2) If we have e' = e+1 => single-epoch boundary
  if (newEpoch === oldEpoch + 1) {
    const oldEpochStart = oldEpoch * EPOCH_LENGTH;
    const tailBoundary  = oldEpochStart + CONTEST_DURATION;
    const oldInTail = oldState.tau >= tailBoundary;
    const oldAccumulatorFull = (oldState.gamma_a.length === EPOCH_LENGTH);
    if (oldInTail && oldAccumulatorFull) {
      // => Z(gamma_a)
      newState.gamma_s = { tickets: outsideInTickets(oldState.gamma_a) };
    } else {
      // => fallback
      newState.gamma_s = fallbackGammaS(newState.eta[2], newState.kappa);
    }
    return;
  }

  // 3) If e' > e+1 => multi-epoch skip => fallback
  newState.gamma_s = fallbackGammaS(newState.eta[2], newState.kappa);
}



/**
 * fallbackGammaS:
 * Implements the fallback function F (6.26)).
 * For each index i from 0 to EPOCH_LENGTH - 1, it computes a hash over
 * the concatenation of eta 2 posterio and the 4 byte little endian encoding of i
 * The resulting hash is used modulo the number
 * of active validators in k to select a validator’s bandersnatch key.
 *
 * @param eta2 - The updated entropy value postState.eta[2]
 * @param kappa - The current active validator set kappa posterior
 * @returns An object with the new slot‑sealer sequence 
 */
function fallbackGammaS(eta2: Uint8Array, kappa: ValidatorInfo[]): { keys: BandersnatchPublic[] } {
  const keys: BandersnatchPublic[] = [];
  // We assume E = EPOCH_LENGTH sealing keys per epoch
  for (let i = 0; i < EPOCH_LENGTH; i++) {
    // Encode i as 4 byte little‑endian Uint8Array.
    const indexBytes = new Uint8Array(4);
    new DataView(indexBytes.buffer).setUint32(0, i, true);
    // Compute hash
    const hash = blake2bConcat(eta2, indexBytes);
    // Use the first 4 bytes of the hash as a uint32.
    const hashNum = new DataView(hash.buffer).getUint32(0, true);
    const chosenIndex = hashNum % kappa.length;
    keys.push(kappa[chosenIndex].bandersnatch);
  }
  return { keys };
}



/**
 * outsideInTickets:
 * Reorders a ticket array “outside-in.”
 * This is a variant of reorderOutsideIn for an array of tickets.
 */
function outsideInTickets<T extends { id: Uint8Array }>(arr: T[]): T[] {
  const n = arr.length;
  const result: T[] = [];
  let left = 0,
      right = n - 1;
  while (left <= right) {
    if (left === right) {
      result.push(arr[left]);
    } else {
      result.push(arr[left]);
      result.push(arr[right]);
    }
    left++;
    right--;
  }
  return result;
}


/**
 * rotateOneEpoch performs a single-epoch rotation.
 * It rotates entropy and key sets, rebuilds gamma_s (using either outside‑in reordering
 * if the old state's gamma_a is full and we are in the tail, or fallback otherwise),
 * clears gamma_a, and re-calculates the aggregator bytes.
 */
export function rotateOneEpoch(oldState: SafroleState): SafroleState {
  const newState: SafroleState = structuredClone(oldState);

  // Rotate entropy: move η[0]→η[1], η[1]→η[2], η[2]→η[3]
  newState.eta[1] = oldState.eta[0];
  newState.eta[2] = oldState.eta[1];
  newState.eta[3] = oldState.eta[2];

  // Rotate key sets: set λ = old κ, κ = old γ_k.
  newState.lambda = oldState.kappa;
  newState.kappa = oldState.gamma_k;

  // Zero out offenders in γ_k.
  newState.gamma_k = zeroOutOffenders(oldState.iota, oldState.post_offenders);

  // I determine if the old state was in the tail.
  const oldEpoch = Math.floor(oldState.tau / EPOCH_LENGTH);
  const oldEpochStart = oldEpoch * EPOCH_LENGTH;
  const tailBoundary = oldEpochStart + CONTEST_DURATION;
  const oldInTail = oldState.tau >= tailBoundary;
  const oldAccumulatorFull = (oldState.gamma_a.length === EPOCH_LENGTH);

  // Rebuild gamma_s.
  // If we were in tail and the ticket accumulator is full, we reorder tickets.
  // Otherwise, we fall back to computing key
  if (oldInTail && oldAccumulatorFull) {
    newState.gamma_s = { tickets: outsideInTickets(oldState.gamma_a) };
  } else {
    newState.gamma_s = fallbackGammaS(newState.eta[2], newState.kappa);
  }

  // Clear the ticket accumulator for the new epoch
  newState.gamma_a = [];

  // Recalculate aggregator bytes
  const ringKeysStr = newState.gamma_k
    .map(v => Buffer.from(v.bandersnatch).toString("hex"))
    .join(" ");
  const ringSize = newState.gamma_k.length;
  const srsPath = "./ring-vrf/data/zcash-srs-2-11-uncompressed.bin";
  newState.gamma_z = aggregator(ringKeysStr, ringSize, srsPath);

  return newState;
}