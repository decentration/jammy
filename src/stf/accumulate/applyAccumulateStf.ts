
import { arrayEqual, compareBytes, convertToReadableFormat, toHex } from "../../utils";
import { hexStringToBytes, toBytes } from "../../codecs";
import { AccumulateState, AccumulateInput, AccumulateOutput, Reports, AccumulatedQueueItem, AccumulatedQueue, SingleReportItem, ReadyRecord, ReadyQueueItem, ReadyQueue, WorkPackageHash, } from "./types"; 
import { Report } from "../../types";
import { TOTAL_GAS_FOR_ALL_ACCUMULATION, TOTAL_ACCUMULATE_GAS, CORES_COUNT, EPOCH_LENGTH } from "../../consts";
import { gatherAccumulatableReports, computeBlockGasLimit, applyIntermediateChanges, applyDeferredTransfers, integratePreimages } from "./helpers";
import { accumulateAcceptedReports } from "./helpers/accumulateAcceptedReports";
import { chunkAccumulatableReportsByGas } from "./helpers/chunkAccumulatableReportByGas";

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

  // 2) split incoming reports into: immediately-accumulatable (W!); and postponed (WQ => ready_queue)
  const { accumulatable_items : accumulatableItems, ready_queue_posterior_flattened : readyForQueue 
  } = gatherAccumulatableReports(slot, reports, postState);

  // 3) update ready_queue: put the non-ready input reports into ready queue
  updateReadyQueue(postState, slot, preState.slot, readyForQueue );

  // 4) calculate block gas-limit (12.20)
  let blockGasLimit = computeBlockGasLimit(postState);

  const accumulatedHashes = new Set<string>();  
  let accumulatable: ReadyRecord[] = accumulatableItems;
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

// compare Uint8Array by hex key
const key = (h: Uint8Array) => toHex(h);  

// (12.7) queue-editing “E”
function editQueue(bucket: ReadyRecord[], done: Set<string>): ReadyRecord[] {
  return bucket.filter(r => !done.has(key(r.report.package_spec.hash)))
    .map(r => ({
      ...r, 
      dependencies: r.dependencies.filter(dep => !done.has(key(dep)))
  }));
}


function updateReadyQueue(
  state: AccumulateState,
  slot: number,
  preStateSlot: number,
  readyForQueueUnfiltered: ReadyRecord[],
) {
  let accumulatedHashes: Uint8Array[] = [];
  // 1) scrub every bucket with the hashes we just accumulated
  const accumulated = new Set(accumulatedHashes.map(h => toHex(h)));
  state.ready_queue = state.ready_queue.map(b => editQueue(b, accumulated));

  // 2) find which of the new waiting reports aren’t already present
  const existingReports = new Set( state.ready_queue.flatMap(b => b.map(r => key(r.report.package_spec.hash))));
  const freshReports = readyForQueueUnfiltered.filter(r => !existingReports.has(key(r.report.package_spec.hash)));

  // 3) blank out any buckets that were skipped between slots 
  const newIdx = slot % EPOCH_LENGTH;
  const oldIdx = preStateSlot % EPOCH_LENGTH;
  const delta = (newIdx - oldIdx + EPOCH_LENGTH) % EPOCH_LENGTH;

  for (let i = 1; i < delta; i++) {
    state.ready_queue[(oldIdx + i) % EPOCH_LENGTH] = [];
  }

  // 4) merge: keep what survived the scrub + add the fresh ones, and lexicographically sort
  const current = state.ready_queue[newIdx];

  // merge the two arrays and sort
  const merged  = [...current, ...freshReports]
  const mergedAndSorted = merged.sort((a, b) => compareBytes(a.report.package_spec.hash, b.report.package_spec.hash));

  // put the result into the bucket
  state.ready_queue[newIdx] = mergedAndSorted;
}



export function rotateAccumulated(
  state            : AccumulateState,
  prevSlot         : number,
  currentSlot      : number,
) {
  // const E = state.accumulated.length; 

  // if (currentSlot < prevSlot) throw new Error(`slot went backwards (${prevSlot} → ${currentSlot})`);

  // let slotDiff = currentSlot - prevSlot;
  // if (slotDiff > E) slotDiff = E;

  // console.log("slotDiff", slotDiff);
  state.accumulated.shift();   
  state.accumulated.push([])

}


function gasBookeeping(acceptedReports: ReadyRecord[], blockGasLimit: number) {
  // 1) gas bookkeeping: reduce the gas limit by the sum of all gas used in the accepted reports
     const gasUsed = acceptedReports.reduce(
       (sum , r) => sum + r.report.results.reduce((s, x) => s + (x.accumulate_gas ?? 0), 0)
     , 0);
     blockGasLimit -= gasUsed;

}