
import { compareBytes, toHex } from "../../utils";
import { AccumulateState, AccumulateInput, AccumulateOutput, Reports, AccumulatedQueueItem, AccumulatedQueue, SingleReportItem, ReadyRecord, ReadyQueueItem, ReadyQueue, WorkPackageHash, ServicesStatistics, AccumulateEphemeral, } from "./types";
import { EPOCH_LENGTH } from "../../consts";
import { computeBlockGasLimit, applyDeferredTransfers, integratePreimages, gasBookeeping, editQueue, rotateAccumulated, updateReadyQueue } from "./helpers";
import { accumulateAcceptedReports } from "./accumulateAcceptedReports";
import { chunkAccumulatableReportsByGas } from "./chunkAccumulatableReportByGas";
import { gatherAccumulatableReports } from "./gatherAccumulatableReports";
import { Gas, ServicesStatisticsMapEntry } from "../../types";
import { coerceU64 } from "../../codecs";
import { applyIntermediateChanges } from "./applyIntermediateChanges";
import { BS, BI } from "../../risc-pvm/interpreter/host/consts"; // Protocol overhead gas fees per GP 12.24


export const J = (v: any) =>
  JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val));

function snapSvc(state: AccumulateState, sid: number) {
  const acc = state.accounts.find(a => a.id === sid)!;
  const stor = acc.data.storage.map(e => ({
    key: Buffer.from(e.key).toString("hex"),
    len: e.value.length
  }));
  return {
    items: acc.data.service.items,
    bytes: String(acc.data.service.bytes),
    storageCount: stor.length,
    storageLens: stor.map(s => s.len).sort((a, b) => a - b),
  };
}

const RUN = `ACC-TRACE-${Date.now()}`;
const DEBUG_ACC = process.env.JAM_DEBUG_ACC === "1";

/** applyAccumulateStf:
 *  - General idea for the main entry point for the Accumulate STF.
 *  - It takes the pre_state and input, and returns the post_state and output.
 *  - 1) Clone preState, and get data from input and preState
 *  - 2) Gather "accumulatable items" (the final set W*) from input.reports & preState.ready_queue 
 *       (12.4)- 12.12)
 *  - 3) Computesblock gas-limit g (12.20)
 *  - 4) Perform accumulation for each service using pvm-ffi. 
 *       Accumulates all relevant services by running their pvm logic
 *      (12.16 - 12.17). Single-service logic (12.19), concurrently.
 *  - 6) Apply intermediate changes
 *  - 7) TODO: Handle deferred async transfers (12.26 - 12.30)
 *  - 8) TODO: Integrate new preimages (12.34 - 12.39)
 *  - 9) Update state, done!
 * @param preState 
 * @param input 
 * @returns 
 */
export async function applyAccumulateStf(
  preState: AccumulateState,
  input: AccumulateInput,
): Promise<{ output: AccumulateOutput; postState: AccumulateState }> {

  // 1) clone preState, deconstruct input, and rotate accumulated
  const { slot, reports } = input;
  const postState: AccumulateState = structuredClone(preState);
  console.log(RUN, "PRE svc1729", snapSvc(postState, 1729));

  rotateAccumulated(postState, preState.slot, slot); // 12.32

  // 2)
  // When we find an accumulable we add such items to the accumulatableReports list. 
  // split incoming reports into: immediately accumulatable (W!) and postponed (WQ => ready_queue)
  const { accumulatable_items: accumulatableReports, ready_queue_posterior_flattened: waiting
  } = gatherAccumulatableReports(slot, reports, postState);

  if (DEBUG_ACC) {
    console.log("[acc] accumulatable:", accumulatableReports.length, "waiting:", waiting.length);
  }

  // 3) update ready_queue: put the non-ready input reports into ready queue
  updateReadyQueue(postState, slot, preState.slot, waiting);

  // 4) calculate block gas-limit (12.20)
  let blockGasLimit: Gas = computeBlockGasLimit(postState);

  const accumulatedHashes = new Set<string>();
  const nowAccumulatable: ReadyRecord[] = accumulatableReports;
  const possiblyAccumulatable: ReadyRecord[] = [];


  // we need to update accumulatable with reports that has available dependencies
  let accumulatable: ReadyRecord[] = nowAccumulatable.concat(possiblyAccumulatable)
  let allOutputs: AccumulateEphemeral[] = [];

  const perService = new Map<number, { count: number; gas: Gas }>();

  const processed: ReadyRecord[] = [];

  // 5) loop over the accumulatable reports
  while (accumulatable.length) {

    // 5a)  pick a gas-bounded prefix (12.16)
    const { acceptedReports, leftoverReports } = chunkAccumulatableReportsByGas(accumulatable, blockGasLimit);
    processed.push(...acceptedReports);

    if (DEBUG_ACC) {
      console.log("[acc] accepted:", acceptedReports.length,
        "leftover:", leftoverReports.length,
        "blockGas:", String(blockGasLimit));
    }

    // nothing fits => break
    if (acceptedReports.length === 0) break;




    // 5b) accumulate them 12.17
    const { accumulatedOutputs: batchResults, newlyAccumulatedHashes, totalActualGasUsed } = await accumulateAcceptedReports(
      postState,
      acceptedReports,
      blockGasLimit,
      slot
    );

    // Per-service stats from actual gas
    // GP A.44
    // Plus protocol overhead from 12.24
    for (const br of batchResults) {
      const sid = br.serviceId;
      const cur = perService.get(sid) ?? { count: 0, gas: 0n };
      const itemCount = br.itemCount ?? 1;
      cur.count += itemCount;

      // Raw PVM gas: u = initial_gas - remaining_gas
      const rawGas = br.actualGasUsed ?? 0n;

      // B.9: if code was unavailable (c is null), total gas = 0
      if (br.codeUnavailable) {
        cur.gas += 0n;  // B.9: u = 0 when c = ∅
        perService.set(sid, cur);
        continue;
      }

      // Protocol overhead per B.5 spec:
      // - BS (100): Base setup cost per invocation
      // - BI (10): Per work item cost
      // - g (10): Per host call cost (not charged inside PVM)
      // - Storage write overhead: write(4) + key_length per write
      const numStorageWrites = br.storageWrites?.length ?? 0;
      const numInserts = br.storageInsertCount ?? 0;
      const bytesDelta = br.storageValueBytesDelta ?? 0;
      const uniqueKeys = br.uniqueKeysWritten ?? 0;
      const isInsertCase = numInserts > 0;
      const hostCallCount = br.hostCallCount ?? 0;

      // Base overhead: BS + BI, plus extra BI for multi-item state serialization
      const multiItemOverhead = itemCount > 1 ? BigInt(BI) : 0n;
      const baseCost = BigInt(BS) + BigInt(BI) + multiItemOverhead;
      const hostCallGas = BigInt(hostCallCount) * 10n;  // g=10 per host call (B.5)

      // Storage write overhead: write=4 + key_length for each unique key written
      // Multiple writes to the same key only count once
      let storageWriteOverhead = 0n;
      if (br.storageWrites) {
        const uniqueKeys = new Set<string>();
        for (const sw of br.storageWrites) {
          const keyHex = Buffer.from(sw.key).toString('hex');
          if (!uniqueKeys.has(keyHex)) {
            uniqueKeys.add(keyHex);
            // write=4 base + key length per unique key
            storageWriteOverhead += 4n + BigInt(sw.key.length);
          }
        }
      }

      const protocolOverhead = baseCost + hostCallGas + storageWriteOverhead;
      const totalGas = rawGas + protocolOverhead;

      if (process.env.JAM_DEBUG_ACC === '1') {
        console.log(`[acc:gas] svc=${sid} rawPvmGas=${rawGas} overhead=${protocolOverhead} totalGas=${totalGas}`);
      }

      cur.gas += totalGas;
      perService.set(sid, cur);
    }

    allOutputs.push(...batchResults);

    // const g = (x: any) => (x !== undefined && x !== null) ? (coerceU64(x) ?? 0n) : 0n;

    // for (const rec of processed) {
    //   for (const item of rec.report.results) {
    //     const sid = item.service_id;
    //     const cur = perService.get(sid) ?? { count: 0, gas: 0n };
    //     cur.count += 1;
    //     cur.gas += g(item.accumulate_gas);  // sum advertised per-item gas
    //     perService.set(sid, cur);
    //   }
    // }



    // if (DEBUG_ACC) {
    //   const writes = batchResults.flatMap(r => r.ephemeralForThisReport ?? [])
    //                              .flatMap(e => e.ephemeral?.storageWrites ?? []);
    //   console.log("[acc] batch outputs:", batchResults.length, 
    //               "storageWrites:", writes.length);
    // }


    // 5c) gas bookkeeping: reduce the gas limit by the sum of all gas used in the accepted reports
    blockGasLimit = blockGasLimit - totalActualGasUsed;
    // 5c.2) check if we are out of gas
    if (blockGasLimit <= 0n) break;

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


  // 6) apply intermediate changes 
  applyIntermediateChanges(postState, allOutputs, slot);

  if (process.env.JAM_DEBUG_ACC === "1") {
    const svc = postState.accounts.find(a => a.id === 1729);
    if (svc) {
      console.log(
        `[acc:post] svc=1729 items=${svc.data.service.items} bytes=${svc.data.service.bytes.toString()}`
      );
      for (const e of svc.data.storage) {
        console.log(`[acc:post] key=${Buffer.from(e.key).toString("hex")} len=${e.value.length}`);
      }
    }
  }


  // 7) TODO: handle deferred transfers 
  applyDeferredTransfers(postState, allOutputs);

  // 8) TODO: integrate new preimages
  integratePreimages(postState);

  // Services

  postState.statistics = Array.from(perService.entries())
    .map<ServicesStatisticsMapEntry>(([id, { count, gas }]) => ({
      id,
      record: {
        provided_count: 0,
        provided_size: 0,
        refinement_count: 0,
        refinement_gas_used: 0n,
        imports: 0,
        extrinsic_count: 0,
        extrinsic_size: 0,
        exports: 0,
        accumulate_count: count,
        accumulate_gas_used: gas,
      },
    }))
    .sort((a, b) => a.id - b.id);

  for (const [sid, { count }] of perService.entries()) {
    if (count > 0) {
      const acc = postState.accounts.find(a => a.id === sid);
      if (acc) acc.data.service.last_accumulation_slot = slot;
    }
  }


  // 9) Update state
  const finalOutput: AccumulateOutput = { ok: new Uint8Array(32) };
  console.log(RUN, "POST svc1729", snapSvc(postState, 1729));
  console.log(RUN, "stats", J(postState.statistics.find(s => s.id === 1729)?.record));
  return { output: finalOutput, postState };
}

