import { toHex, convertToReadableFormat } from "../../../utils";
import { Reports, AccumulateState, ReadyRecord } from "../types";

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

    const readyQueue = state.ready_queue;
    // gather all items in the ready queue
    const allQueueItems: ReadyRecord[] = [];
    let nowAccumulateItems:  ReadyRecord[] = []; // W*= W! concat satisfied WQ
    let readyQueueItems: ReadyRecord[] = []; // WQ waiting

    // partition new items with no dependencies vs. queued
    const decided = new Set<ReadyRecord>();

    // building the working queue

    //  Flatten existing queue
    for (const sub of state.ready_queue) allQueueItems.push(...sub);

    // put all deps (prerequisites or segment_root_lookup) in dependencies
    for (const rep of inputReports) {
        const prereqDeps = rep.context.prerequisites ?? []; 
        const srDeps =
        (rep.segment_root_lookup ?? []).map(x => x.work_package_hash as Uint8Array);
        const allDeps = prereqDeps.concat(srDeps);  
        const item: ReadyRecord = { report: rep, dependencies: allDeps };
        allQueueItems.push(item);
    }
    

    const accumulatedHashSet = new Set(
      state.accumulated.flat().map(toHex)
    );

    // using this while boolean approach, can probably be optimized (TODO)
    let progress = true;

    console.log("alQueuItems", allQueueItems.map(i => ({ hash: toHex(i.report.package_spec.hash), dependencies: convertToReadableFormat(i.dependencies) })));

    // 
    while (progress) {
      progress = false;

      const nowHashSet = new Set(nowAccumulateItems.map(wr => toHex(wr.report.package_spec.hash)));

  
      for (const item of allQueueItems) {
        if (decided.has(item)) {
          continue; 
        }

        // Check if the item has no dependencies
        const deps = item.dependencies ?? [];
        // if item has no dependencies then its accumulated and can go str aight to W!
        if (deps.length === 0) {
          nowAccumulateItems.push(item);
          decided.add(item);
          progress = true;
          continue;
        }   
              
        // If we find a dependency in the queue, then the item that the dep belongs to can still be accumulatable
        // if all deps are in the queue then the item is accumulatable. 
        // Check if all deps are satisfied (only with main items, not the items deps  => either dep is in "accumulated" list or is in nowAccumulateItems list
        const allDepsSatisfied = deps.every(depHash => {
          const depStr = toHex(depHash as Uint8Array);
  
          // Check if the dependency is in the accumulated list
          if (accumulatedHashSet.has(depStr)) return true;
  
          // Check if the dependency is in the nowAccumulateItems list
          if (nowHashSet.has(depStr)) return true;
  
          return false;
        });

  
        if (allDepsSatisfied) {
          // => item can go to W!
          nowAccumulateItems.push(item);
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
        nowAccumulateItems: convertToReadableFormat(nowAccumulateItems.map(i => toHex(i.report.package_spec.hash))), 
        readyQueueItems: convertToReadableFormat(readyQueueItems.map(i => toHex(i.report.package_spec.hash)))
    };
    
    console.log("readableObject nowAccumulateItems and readyQueue", readableObject);

    return { 
        accumulatable_items: nowAccumulateItems, 
        ready_queue_posterior_flattened: readyQueueItems 
    };
  }