
import { arrayEqual, convertToReadableFormat, toHex } from "../../utils";
import { hexStringToBytes, toBytes } from "../../codecs";
import { AccumulateState, AccumulateInput, AccumulateOutput, Reports, AccumulatedQueueItem, AccumulatedQueue, } from "./types"; 
import { Report } from "../../types";
import { TOTAL_GAS_FOR_ALL_ACCUMULATION, TOTAL_ACCUMULATE_GAS, CORES_COUNT } from "../../consts";

/** applyAccumulateStf:
 *  - General idea for the main entry point for the Accumulate STF.
 *  - It takes the pre_state and input, and returns the post_state and output.
 *  - 1) Clone preState, and get data from input and preState
 *  - 2) TODO: Gather "accumulatable items" (the final set W*) from input.reports & preState.ready_queue 
 *       (12.4)- 12.12)
 *  - 3) TODO: Computesblock gas-limit g (12.20)
 *  - 4) TODO: Perform accumulation for each service using pvm-ffi. 
 *       Accumulates all relevant services by running their pvm logic
 *      (12.16 - 12.17). Single-service logic (12.19), concurrently.
 *  - 5) TODO: Apply intermediate changes
 *  - 6) TODO: Handle deferred async transfers (12.26 - 12.30)
 *  - 7) TODO: Integrate new preimages (12.34 - 12.39)
 *  - 8) TODO: Build final output (12.15) and (12.21)
 *  - 9) Update state, done!
 * @param preState 
 * @param input 
 * @returns 
 */
export async function applyAccumulateStf( preState: AccumulateState, input: AccumulateInput): 
Promise<{ output: AccumulateOutput, postState: AccumulateState }> {
  // 1) Clone preState
  const { slot, reports } = input;
  let postState = structuredClone(preState) as AccumulateState;

  // 2) TODO: Gather accumulatable items (W*) and then partition and filter within...
  const accumulatableItems = gatherAccumulatableItems(slot, reports, postState);

  // 3) TODO: block gas limit (g) 12.20 
  const blockGasLimit = computeBlockGasLimit(postState, accumulatableItems);

  // 4) TODO: Perform acccumulation for each service concurrently
  const { updatedPostState, accumulatedOutputs } = accumulateAllServices(postState, accumulatableItems, blockGasLimit);
  postState = updatedPostState;

  // 5) TODO: apply intermediate changes 
  applyIntermediateChanges(postState, accumulatedOutputs);

  // 6) TODO: handle deferred transfers 
  applyDeferredTransfers(postState, accumulatedOutputs );

  // 7) TODO: integrate new preimages
  integratePreimages(postState);

  // 8) final output
  const finalOutput = buildAccumulateOutput(postState);

  // 9) Update state
  return { output: finalOutput, postState: postState};
}


/**
 * gatherAccumulatableItems:
 * - (12.4)-(12.5) partition new items with no dependencies vs. queued 
 * - (12.7)-(12.12) merges with existing preState.ready_queue to form W* 
 */
function gatherAccumulatableItems(
    slot: number,
    reports: Reports,
    state: AccumulateState
  ): AccumulatedQueue {
    // TODO:
    //  - Combine input.reports + state.ready_queue
    //  - Filter out items with unsatisfied dependencies
    //  - return final accumulatable subset 
    return [];
  }

/**
 * computeBlockGasLimit:
 *   - (12.20)
 *  */
function computeBlockGasLimit(
    state: AccumulateState,
    items: AccumulatedQueue
  ): number {
    // TODO:
    // 12.20 block budgeting 
    // let g = max(GT , GA ⋅ C + ∑x∈V(χg )(x))
    // ∑x∈V(χg )(x)) is the sum of always accumulate gas from privilged services pre_state.privileges.always_acc
    // so gas limit GT or GA * C + sum of always_acc gas
    // C = 341 for full. 
    // χ: The privileged service indices.
    // χg : The always-accumulate service indices and their basic gas allowance.
    // GA = 10, 000, 000: The gas allocated to invoke a work-report’s Accumulation logic. 
    // GT = 3, 500, 000, 000: The total gas allocated across for all Accumulation. Should be no smaller than GA ⋅ C + ∑g∈V(χg )(g). 
    // TOTAL_ACCUMULATE_GAS = GA
    // TOTAL_GAS_FOR_ALL_ACCUMULATION = GT
    // CORES_COUNT = C

    // we use Math.max to get the max of the two
    // we want to ensure that our final gas limit cannot fall below GT
    


    let blockGasLimit = TOTAL_GAS_FOR_ALL_ACCUMULATION // GT
    // Add all the privileges, C (concurrency), etc.

    // sum always accumulate gas
    let sumAlwaysAccGas = 0;
    // TODO: for (const entry of state.privileges.always_acc) {
    //   sumAlwaysAccGas += entry.gas;
    // }

    const candidate = TOTAL_ACCUMULATE_GAS * CORES_COUNT + sumAlwaysAccGas

    blockGasLimit = Math.max(TOTAL_GAS_FOR_ALL_ACCUMULATION, candidate );

    return blockGasLimit;
  }