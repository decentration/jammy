
import { StatsState, StatsInput, StatsOutput, PerformanceRecord } from "./types";
import { EPOCH_LENGTH } from "../../consts";

/**
 * applyStatsStf:
 * The state-transition logic for the statistics module.
 */
export function applyStatsStf(
  preState: StatsState,
  input: StatsInput
): { output: StatsOutput; postState: StatsState } {
    const e = Math.floor(preState.slot / EPOCH_LENGTH);
    const ePrime = Math.floor(input.slot / EPOCH_LENGTH);
  
    // old references
    const oldAccumulator = preState.statistics.vals_current;
    const oldPrevious = preState.statistics.vals_last;
  
    let newAccumulator: PerformanceRecord[];
    let newPrevious: PerformanceRecord[];
  
    // Check if we rotate epoch stats
    if (ePrime === e) {
      // Same epoch => keep the existing (current, last)
      newAccumulator = clonePerformanceArray(oldAccumulator);
      newPrevious    = clonePerformanceArray(oldPrevious);
    } else {
      // New epoch => shift current -> last, and zero out new current
      newAccumulator = zeroPerformanceArray(oldAccumulator.length);
      newPrevious    = clonePerformanceArray(oldAccumulator);
    }
  
    // Equation (13.4): update newAccumulator with the extrinsic data
  
    // 1) If v == author_index => increment blocks, tickets, preimages, preimages_size...
    if (newAccumulator[input.author_index]) {
      // blocks
      newAccumulator[input.author_index].blocks += 1;
  
      // tickets
      newAccumulator[input.author_index].tickets += input.extrinsic.tickets.length;
  
      // pre_images and pre_images_size
      newAccumulator[input.author_index].pre_images += input.extrinsic.preimages.length;
      let totalPreimagesSize = 0;
      for (const pre of input.extrinsic.preimages) {
        totalPreimagesSize += pre.blob.length;
      }
      newAccumulator[input.author_index].pre_images_size += totalPreimagesSize;
    }
  
    // 2) For each guarantee => for each signature => increment guarantees for that validator index
    for (const g of input.extrinsic.guarantees) {
      for (const sig of g.signatures) {
        const v = sig.validator_index;
        if (newAccumulator[v]) {
          newAccumulator[v].guarantees += 1;
        }
      }
    }
  
    // 3) For each assurance => increment assurances for that validator_index
    for (const a of input.extrinsic.assurances) {
      if (newAccumulator[a.validator_index]) {
        newAccumulator[a.validator_index].assurances += 1;
      }
    }
    
    // TODO: confirm that post state for tau and kappa prime is the same as the pre_state because
    // they are not modified in this function
    const postState: StatsState = {
      statistics: {
        vals_current: newAccumulator,
        vals_last: newPrevious,
        cores: preState.statistics.cores,
        services: preState.statistics.services,
      },
      slot: preState.slot,
      curr_validators: preState.curr_validators,
    };
  
    // Always null output
    const output: StatsOutput = null;
  
    return { output, postState };
  }
  
  
  function clonePerformanceArray(
    arr: PerformanceRecord[]
  ): PerformanceRecord[] {
    return arr.map((rec) => ({ ...rec }));
  }
  
  function zeroPerformanceArray(
    length: number
  ): PerformanceRecord[] {
    const out: PerformanceRecord[] = [];
    for (let i = 0; i < length; i++) {
      out.push({
        blocks: 0,
        tickets: 0,
        pre_images: 0,
        pre_images_size: 0,
        guarantees: 0,
        assurances: 0,
      });
    }
    return out;
  }