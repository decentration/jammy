import { blake2bConcat } from "./helpers"; 
import { SafroleState } from "./types";
import { EPOCH_LENGTH } from "../consts";
import { ValidatorInfo } from "../stf/types";
import { BandersnatchPublic } from "../types/types";


/**
 * reorderOutsideIn:
 * Implements the outside‑in reordering function Z (6.25).
 * @param s - Array of strings (e.g. ticket IDs)
 * @returns Reordered array.
 */
function reorderOutsideIn(s: BandersnatchPublic[]): BandersnatchPublic[] {
  const n = s.length;
  const result: BandersnatchPublic[] = [];
  let left = 0, right = n - 1;
  while (left <= right) {
    if (left === right) {
      result.push(s[left]);
    } else {
      result.push(s[left]);
      result.push(s[right]);
    }
    left++;
    right--;
  }
  return result;
}

/**
 * fallbackGammaS:
 * Implements the fallback function F (6.26)).
 * For each index i from 0 to EPOCH_LENGTH - 1, it computes a hash over
 * the concatenation of eta 2 posterio and the 4 byte little endian encoding of i
 * The resulting hash (interpreted as a 32‑bit unsigned integer) is used modulo the number
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
    // Compute hash = blake2b(postState.eta[2] || indexBytes)
    const hash = blake2bConcat(eta2, indexBytes);
    // Use the first 4 bytes of the hash as a uint32.
    const hashNum = new DataView(hash.buffer).getUint32(0, true);
    const chosenIndex = hashNum % kappa.length;
    keys.push(kappa[chosenIndex].bandersnatch);
  }
  return { keys };
}

/**
 * rebuildGammaSForEpochChange:
 * 6.24
 *   - If the ticket accumulator is full (i.e. length equals EPOCH_LENGTH),
 *     then we compute  gamma s = Z(gamma_a), using the outside‑in reordering function Z.
 *   - Otherwise, we fallback to computing gamma_s = F(eta[2], kappa)
 *     where F is implemented by fallbackGammaS.
 *
 * @param state - The current SafroleState (which must already have updated eta[2] from an epoch rotation)
 * @param justEndedEpoch - A flag indicating that an epoch boundary was crossed
 */
export function rebuildGammaSForEpochChange(state: SafroleState, justEndedEpoch: boolean): void {
  if (!justEndedEpoch) return; // Only rebuild if an epoch ended
  
  if (state.gamma_a.length === EPOCH_LENGTH) {
    // Normal mode: use the outside-in sequencer Z (6.25)
    const ticketIds = state.gamma_a.map(t => t.id);
    state.gamma_s = { keys: reorderOutsideIn(ticketIds) };
  } else {
    // Fallback mode (6.26)
    // state.eta[2] is the rotated entropy value 
    state.gamma_s = fallbackGammaS(state.eta[2], state.kappa);
  }
}

