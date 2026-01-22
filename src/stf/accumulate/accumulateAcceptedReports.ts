import { Gas } from "../../types";
import { AccumulateEphemeral, AccumulateState, ReadyRecord, ReportContext } from "./types";
import { accumulateSingleService } from "./accumulateSingleService";

// Aggregated service data from multiple reports
interface ServiceAggregate {
  items: any[];                    // Work item results for this service
  reportContexts: ReportContext[]; // Context from each contributing report (aligned with items)
  reportHashes: Uint8Array[];      // Hashes of reports that contributed items
}

/**
 * accumulateAcceptedReports:
 *  Per GP 12.19/12.24:
 *  - ∆∗ gathers all services from all reports
 *  - ∆1 is called ONCE per service with ALL work items for that service
 *  - Each work item carries its own (p, e, a) from its source report per C.29
 *  - This amortizes PVM setup cost over all work items for each service
 */
export async function accumulateAcceptedReports(
  state: AccumulateState,
  acceptedReports: ReadyRecord[],
  blockGasLimit: Gas,
  slot: number
): Promise<{
  updatedPostState: AccumulateState;
  accumulatedOutputs: AccumulateEphemeral[];
  newlyAccumulatedHashes: Uint8Array[];
  totalActualGasUsed: bigint;
}> {
  const outputs: AccumulateEphemeral[] = [];
  const done: Uint8Array[] = [];
  let totalActualGasUsed = 0n;

  // 1) Aggregate work items ACROSS all reports by service_id (12.19)
  // gather all service IDs from all work items
  const serviceAggregates = new Map<number, ServiceAggregate>();

  for (const record of acceptedReports) {
    const rep = record.report;
    const repHash = rep.package_spec.hash;

    // Build context for this report (used for per-item encoding per C.29)
    const reportContext: ReportContext = {
      packageSpec: rep.package_spec,
      authorizerHash: rep.authorizer_hash,
      authOutput: rep.auth_output,
      context: rep.context,
    };

    // Aggregate each result to its service
    for (const res of rep.results) {
      const sid = res.service_id;
      const agg = serviceAggregates.get(sid) ?? {
        items: [],
        reportContexts: [],
        reportHashes: [],
      };
      agg.items.push(res);
      agg.reportContexts.push(reportContext);  // Per-item context!
      agg.reportHashes.push(repHash);
      serviceAggregates.set(sid, agg);
    }

    // Track this report as newly accumulated (12.21/12.23)
    if (!state.accumulated[state.accumulated.length - 1]) {
      state.accumulated.push([]);
    }
    state.accumulated[state.accumulated.length - 1].push(repHash);
    done.push(repHash);
  }

  // 2) Invoke ∆1 (single-service accumulation) once per service (12.24)
  for (const [serviceId, agg] of serviceAggregates.entries()) {
    const ep = await accumulateSingleService(
      state,
      slot,
      serviceId,
      agg.items,             // All work items for this service
      blockGasLimit,
      agg.reportContexts     // Per-item report contexts (aligned with items)
    );

    outputs.push(ep);
    totalActualGasUsed += (ep.actualGasUsed ?? 0n);
  }

  return {
    updatedPostState: state,
    accumulatedOutputs: outputs,
    newlyAccumulatedHashes: done,
    totalActualGasUsed,
  };
}
