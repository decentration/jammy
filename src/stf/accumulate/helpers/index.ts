import { CORES_COUNT, EPOCH_LENGTH, TOTAL_ACCUMULATE_GAS, TOTAL_GAS_FOR_ALL_ACCUMULATION } from "../../../consts";
import { toHex } from "../../../utils";
import { AccumulateEphemeral, AccumulateState, ReadyRecord } from "../types";
// import { pvmAccumulate } from "../ffi/pvm_ffi/pvm_ffi"; 

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




// (12.7) queue-editing “E”
export function editQueue(bucket: ReadyRecord[], done: Set<string>): ReadyRecord[] {
  return bucket.filter(r => !done.has(toHex(r.report.package_spec.hash)))
    .map(r => ({
      ...r, 
      dependencies: r.dependencies.filter(dep => !done.has(toHex(dep)))
  }));
}


export function updateReadyQueue(
  state: AccumulateState,
  slot: number,
  preStateSlot: number,
  waiting: ReadyRecord[],
) {

  console.log("waiting", waiting.map(r => toHex(r.report.package_spec.hash)));
  let accumulatedHashes: Uint8Array[] = [];
  // 1) scrub every bucket with the hashes we just accumulated
  const done = new Set(accumulatedHashes.map(h => toHex(h)));
  state.ready_queue = state.ready_queue.map(b => editQueue(b, done));

  const newIdx = slot % EPOCH_LENGTH;
  const oldLandingBucket = state.ready_queue[preStateSlot % EPOCH_LENGTH];

  // 2) find which of the new waiting reports aren’t already present implying that they are fresh.
  const existingReports = new Set( state.ready_queue.flatMap(b => b.map(r => toHex(r.report.package_spec.hash))));
  const freshReports = waiting.filter(r => !existingReports.has(toHex(r.report.package_spec.hash)));
  
  console.log("oldLandingBucket", oldLandingBucket.map(r => toHex(r.report.package_spec.hash)));
  console.log("existingReports", existingReports);
  console.log("freshReports", freshReports.map(r => toHex(r.report.package_spec.hash)));

  wipeSkippedBuckets(state, preStateSlot, slot);

  // if report in current bucket is accumulatable we add 

  // Check the old landing bucket and see if any reports from the landing bucket are in the 
  // waiting list. If they are then we remove those items from the waiting list. 
  // But if they are not then they will be accumulated. 
  const checkedReports = oldLandingBucket.filter(r => {
    const hash = toHex(r.report.package_spec.hash);
    return !freshReports.some(w => toHex(w.report.package_spec.hash) === hash);
  });
  console.log("checkedReports", checkedReports.map(r => toHex(r.report.package_spec.hash)));

  // 4) merge: keep what survived the scrub + add the fresh ones
  const current = state.ready_queue[newIdx];
  console.log("current", current.map(r => toHex(r.report.package_spec.hash)));

  const merged = [...current, ...freshReports]

  console.log("merged", merged.map(r => toHex(r.report.package_spec.hash)));
  // put the result into the bucket
  state.ready_queue[newIdx] = merged;
  

  console.log("state.ready_queue", state.ready_queue.map(b => b.map(r => toHex(r.report.package_spec.hash))));
}

function wipeSkippedBuckets(state: AccumulateState, preSlot: number, newSlot: number) {
  // 3) blank out any buckets that were skipped between slots 
  const newIdx = newSlot % EPOCH_LENGTH;
  const oldIdx = preSlot % EPOCH_LENGTH;
  console.log("newIdx", newIdx, "oldIdx", oldIdx);
  const delta = (newIdx - oldIdx + EPOCH_LENGTH) % EPOCH_LENGTH;

    // we wipe out the buckets that were skipped
    for (let i = 1; i <= delta; i++) {
      state.ready_queue[(oldIdx + i) % EPOCH_LENGTH] = [];
    }
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


export function gasBookeeping(acceptedReports: ReadyRecord[], blockGasLimit: number) {
  // 1) gas bookkeeping: reduce the gas limit by the sum of all gas used in the accepted reports
     const gasUsed = acceptedReports.reduce(
       (sum , r) => sum + r.report.results.reduce((s, x) => s + (x.accumulate_gas ?? 0), 0)
     , 0);
     blockGasLimit -= gasUsed;

}