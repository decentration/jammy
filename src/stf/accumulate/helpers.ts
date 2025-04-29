import { CORES_COUNT, TOTAL_ACCUMULATE_GAS, TOTAL_GAS_FOR_ALL_ACCUMULATION } from "../../consts";
import { convertToReadableFormat } from "../../utils";
import { AccumulateEphemeral, AccumulateOutput, AccumulateState, ReadyRecord, Reports, WorkPackageHash } from "./types";
// import { pvmAccumulate } from "../ffi/pvm_ffi/pvm_ffi"; 


/**
 * gatherAccumulatableReports:
 * - (12.4)-(12.5) partition new items (reports) with no dependencies vs. queued 
 * - (12.7)-(12.12) merges with existing preState.ready_queue to form W* 
 */
export function gatherAccumulatableReports(
    slot: number,
    inputReports: Reports,
    state: AccumulateState
  ): { accumulatable_items: ReadyRecord[], ready_queue_posterior_flattened: ReadyRecord[] } {
    console.log("gatherAccumulatableReports reports", inputReports);
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
        const srLookupItems = item.report.segment_root_lookup ?? [];
        const srLookupHashes = srLookupItems.map((item) => item.work_package_hash);
  
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
export function computeBlockGasLimit(
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

export async function accumulateSingleService(
  state: AccumulateState,          // The chain state
  slot: number,                    // Current slot from eq. (12.19) if needed
  serviceId: number,
  serviceItems: any[],            // Typically the results relevant to this service
  blockGasLimit: number
): Promise<AccumulateEphemeral> {

  // 1) Retrieve the service codeHash / other relevant info from chain state
  const svc = state.accounts.find(a => a.id === serviceId);
  if (!svc) {
    // If the service doesn't exist or was self-terminated => no accumulation
    return {
      selfTerminated: false
    };
  }

  const currentCodeHash = svc.data.service.code_hash;

  const ephemeral = await pvmAccumulatePlaceholder( 
    slot,
    serviceId,
    currentCodeHash,
    serviceItems,
    blockGasLimit
);

  return ephemeral;
}


export function applyIntermediateChanges(
  state: AccumulateState,
  accumulatedOutputs: any[]
) {
  // If some ephemeral changes need final unification
}

export function applyDeferredTransfers(state: AccumulateState, accumulatedOutputs: any[]) {
  // gather ephemeral newTransfers => apply 
}

export function integratePreimages(state: AccumulateState) {
  // (12.34) to (12.39)
}

// export async function pvmAccumulate(
//   slot: number,
//   serviceId: number,
//   codeHash: Uint8Array,
//   serviceItems: any[],
//   chainPartial: any,
//   gasLimit: number
// ): Promise<AccumulateEphemeral> {
//   const itemsJson = JSON.stringify(serviceItems);
//   const resBytes  = jamPvmAccumulate(
//       slot, 
//       serviceId,
//       codeHash,                // pass raw 32 bytes
//       Buffer.from(itemsJson),
//       gasLimit
//   );
//   return JSON.parse(resBytes.toString());
// }

async function pvmAccumulatePlaceholder(
  slot: number,
  serviceId: number,
  codeHash: Uint8Array,
  items: any[],
  gasLimit: number,
): Promise<AccumulateEphemeral> {
  // TODO: Real code would call the PVM FFI, which we have started. 
  // but we just return a dummy ephemeral object
  return {
    newTransfers: [],
    newServices: [],
    codeUpgrades: [],
    selfTerminated: false,
    commitmentHash: undefined,
    actualGasUsed: 0
  };
}

