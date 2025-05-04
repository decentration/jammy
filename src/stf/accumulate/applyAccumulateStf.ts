
import { compareBytes, toHex } from "../../utils";
import { AccumulateState, AccumulateInput, AccumulateOutput, Reports, AccumulatedQueueItem, AccumulatedQueue, SingleReportItem, ReadyRecord, ReadyQueueItem, ReadyQueue, WorkPackageHash, } from "./types"; 
import { EPOCH_LENGTH } from "../../consts";
import { computeBlockGasLimit, applyIntermediateChanges, applyDeferredTransfers, integratePreimages, gasBookeeping, editQueue, rotateAccumulated, updateReadyQueue } from "./helpers";
import { accumulateAcceptedReports } from "./helpers/accumulateAcceptedReports";
import { chunkAccumulatableReportsByGas } from "./helpers/chunkAccumulatableReportByGas";
import { gatherAccumulatableReports } from "./helpers/gatherAccumulatableReports";

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
export async function applyAccumulateStf (
  preState: AccumulateState,
  input: AccumulateInput
): Promise<{ output: AccumulateOutput; postState: AccumulateState }> {
  
  // 1) clone preState, deconstruct input, and rotate accumulated
  const { slot , reports } = input;
  const postState: AccumulateState = structuredClone(preState);
  rotateAccumulated(postState, preState.slot, slot); // 12.32

  // 2)
  // When we find an accumulable we add such items to the accumulatableReports list. 
  // split incoming reports into: immediately accumulatable (W!) and postponed (WQ => ready_queue)
  const { accumulatable_items : accumulatableReports, ready_queue_posterior_flattened : waiting 
  } = gatherAccumulatableReports(slot, reports, postState);

  // 3) update ready_queue: put the non-ready input reports into ready queue
  updateReadyQueue(postState, slot, preState.slot, waiting );

  // 4) calculate block gas-limit (12.20)
  let blockGasLimit = computeBlockGasLimit(postState);

  const accumulatedHashes = new Set<string>();  
  const nowAccumulatable: ReadyRecord[] = accumulatableReports;
  const possiblyAccumulatable: ReadyRecord[] = [];


  // we need to update accumulatable with reports that has available dependencies
  let accumulatable: ReadyRecord[] = nowAccumulatable.concat(possiblyAccumulatable)
  let accumulatedOutputs: any[] = [];

  // 5) loop over the accumulatable reports
  while (accumulatable.length) {

    // 5a)  pick a gas-bounded prefix (12.16)
    const { acceptedReports, leftoverReports } = chunkAccumulatableReportsByGas(accumulatable, blockGasLimit);

    // nothing fits => break
    if (acceptedReports.length === 0) break;

    // 5b) accumulate them 12.17
    const { accumulatedOutputs, newlyAccumulatedHashes } = await accumulateAcceptedReports(
      postState,
      acceptedReports,
      blockGasLimit,
      slot
    );

    accumulatedOutputs.push(...accumulatedOutputs);

    // 5c) gas bookkeeping: reduce the gas limit by the sum of all gas used in the accepted reports
    gasBookeeping(acceptedReports, blockGasLimit);
    // 5c.2) check if we are out of gas
    if (blockGasLimit <= 0) break;

    // 5d) remove the hashes from the ready queue
    // and remove deps now satisfied
    newlyAccumulatedHashes.forEach(h => {
      const hash = toHex(h);
      if (!accumulatedHashes.has(hash)) {
        accumulatedHashes.add(hash);
        // push into current bucket of accumulated if not present yet
        const bucket = postState.accumulated[postState.accumulated.length - 1];
        if (!bucket.some(b => toHex(b) === hash)) {
          bucket.push(h);
        }

        // lexicographic sort 
        bucket.sort((a, b) => compareBytes(a, b));
      }
    });

    // we remove the hashes we just finished from the ready queue
    // and remove any dependencies that are now satisfied
    postState.ready_queue = postState.ready_queue.map(b => editQueue(b, accumulatedHashes));

    // 5e) put leftover part of this batch back to its bucket
    if (leftoverReports.length) {
      const bucket = slot % EPOCH_LENGTH;
      postState.ready_queue[bucket].push(...leftoverReports);
    }

    // 5f) find the next wave of now unblocked reports (12.8)
    accumulatable = postState.ready_queue.flatMap(
      b => b.filter(r => r.dependencies.length === 0)
    );
  }

  // updated slot
  postState.slot = slot;
  

  // 6) TODO: apply intermediate changes 
  applyIntermediateChanges(postState, accumulatedOutputs);

  // 7) TODO: handle deferred transfers 
  applyDeferredTransfers(postState, accumulatedOutputs );

  // 8) TODO: integrate new preimages
  integratePreimages(postState);

   // 9) Update state
  const finalOutput: AccumulateOutput = { ok : new Uint8Array(32) };
  return { output: finalOutput, postState };
}

