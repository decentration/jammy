
import { arrayEqual, convertToReadableFormat, toHex } from "../../utils";
import { hexStringToBytes, toBytes } from "../../codecs";
import { AccumulateState, AccumulateInput, AccumulateOutput, Reports, AccumulatedQueueItem, AccumulatedQueue, SingleReportItem, ReadyRecord, ReadyQueueItem, ReadyQueue, WorkPackageHash, } from "./types"; 
import { Report } from "../../types";
import { TOTAL_GAS_FOR_ALL_ACCUMULATION, TOTAL_ACCUMULATE_GAS, CORES_COUNT } from "../../consts";

/** applyAccumulateStf:
 *  - General idea for the main entry point for the Accumulate STF.
 *  - It takes the pre_state and input, and returns the post_state and output.
 *  - 1) Clone preState, and get data from input and preState
 *  - 2) Gather "accumulatable items" (the final set W*) from input.reports & preState.ready_queue 
 *       (12.4)- 12.12)
 *  - 3) Computesblock gas-limit g (12.20)
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

  // 2) TODO: Gather accumulatable work reports (W*) and then partition and filter within...
  const { accumulatable_items: accumulatableItems, ready_queue_posterior_flattened: flattenedNewReadyQueue } = gatherAccumulatableItems(slot, reports, postState);

  // 3) TODO: block gas limit (g) 12.20 
  const blockGasLimit = computeBlockGasLimit(postState);
  console.log("blockGasLimit", blockGasLimit);

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
    inputReports: Reports,
    state: AccumulateState
  ): { accumulatable_items: ReadyRecord[], ready_queue_posterior_flattened: ReadyRecord[] } {
    console.log("gatherAccumulatableItems reports", inputReports);
    // Notes:
    // W* 
    // ϑ: The accumulation queue.
    // ξ: The accumulation history.

    // 12.4
    // W! ≡ [w S w <− W, S(wx)pS = 0 ∧ wl = {}]

    // 12.7
    //    ⎧ (⟦(W, {H})⟧, {H}) → ⟦(W, {H})⟧
    //    ⎪      
    // E: ⎨ (r, x) ↦   ⎧              ⎪⎧ (w, d) <− r, ⎪
    //    ⎪            ⎪ (w, d ∖ x) W ⎪⎨              ⎪
    //    ⎩            ⎩              ⎪⎩ (ws)h ~∈ x   ⎪             
                     

    // 12.5
    // WQ ≡ E([D(w) S w <− W, S(wx)pS > 0 ∨ wl ≠ {}], ©
    // ξ )(12.5)

    // W! are accumulated immediately
    // WQ are queued in ready_queue

    // gather all items in the ready queue
    const allQueueItems: ReadyRecord[] = [];
    let immediatelyAccumulateItems:  ReadyRecord[] = []; // W*= W! concat satisfied WQ
    let readyQueueItems: ReadyRecord[] = []; // WQ waiting


    //  Flatten existing queue
    for (const subArr of state.ready_queue) {
      for (const qItem of subArr) {
        allQueueItems.push(qItem);
      }
    }

    // convert input reports to ready queue items
    for (const rep of inputReports) {
        const deps = rep.context.prerequisites ?? []; 
        const item: ReadyRecord = { report: rep, dependencies: deps };
        allQueueItems.push(item);
      }
    

    // partition new items with no dependencies vs. queued
    const decided = new Set<ReadyRecord>();

    // using this while boolean approach, can probably be optimized (TODO)
    let progress = true;
    while (progress) {
      progress = false;
  
      for (const item of allQueueItems) {
        if (decided.has(item)) {
          continue; 
        }
        const deps = item.dependencies ?? [];
  
        // Check if all deps are satisfied => either dep is in "accumulated" list or is in immediatelyAccumulateItems list
        const allDepsSatisfied = deps.every((depHash: WorkPackageHash) => {
  
          // Check deps found in accumulated list
          const foundInAccumulated = state.accumulated.some((accItemArr) =>
            accItemArr.includes(depHash)
          );
  
          // Also check if there is a record in immediatelyAccumulateItems with that hash
          const foundInImmediateAccumulateQueueItems = immediatelyAccumulateItems.some((wr) =>
            wr.report.package_spec.hash === depHash
          );
  
          return foundInAccumulated || foundInImmediateAccumulateQueueItems;
        });
  
        if (allDepsSatisfied) {
          // => item can go to W!
          immediatelyAccumulateItems.push(item);
          decided.add(item);
          progress = true;
        }
      }
    }
  
    // after no more items can be satisfied, everything not in "decided" is still waiting
    for (const item of allQueueItems) {
      if (!decided.has(item)) {
        readyQueueItems.push(item);
      }
    }
  
    const readableObject = { 
        immediatelyAccumulateItems: convertToReadableFormat(immediatelyAccumulateItems as ReadyRecord[]), 
        readyQueueItems: convertToReadableFormat(readyQueueItems as ReadyRecord[]) 
    };
    
    console.log("readableObject immediatelyAccumulateItems and readyQueue", readableObject);

    return { 
        accumulatable_items: immediatelyAccumulateItems, 
        ready_queue_posterior_flattened: readyQueueItems 
    };
  }

/**
 * computeBlockGasLimit:
 *   - (12.20)
 *  */
function computeBlockGasLimit(
    state: AccumulateState,
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
    for (const entry of state.privileges.always_acc) {
       sumAlwaysAccGas += entry.gas;
    }

    const candidate = TOTAL_ACCUMULATE_GAS * CORES_COUNT + sumAlwaysAccGas

    blockGasLimit = Math.max(TOTAL_GAS_FOR_ALL_ACCUMULATION, candidate );

    return blockGasLimit;
  }