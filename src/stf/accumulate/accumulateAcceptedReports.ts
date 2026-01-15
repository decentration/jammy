import { Gas } from "../../types";
import { AccumulateEphemeral, AccumulateState, ReadyRecord } from "./types";
import { accumulateSingleService } from "./accumulateSingleService";

/**
 * accumulateAcceptedReports:
 *  - 12.17 done sequentially (can parallelize later).
 *  - For each accepted report:
 *      group items by service (12.19),
 *      run the service VM once,
 *      collect an AccumulateEphemeral per service,
 *      push the report hash into the latest accumulated bucket.
 *  - IMPORTANT: No storage mutations here. We only return ephemerals +
 *    totalActualGasUsed. The caller applies side-effects (writes/deletes)
 *    in one place (applyIntermediateChanges).
 */
export async function accumulateAcceptedReports(
  state: AccumulateState,
  acceptedReports: ReadyRecord[],
  blockGasLimit: Gas,
  slot: number
): Promise<{
  updatedPostState: AccumulateState;
  accumulatedOutputs: AccumulateEphemeral[];        // per-service ephemerals
  newlyAccumulatedHashes: Uint8Array[];
  totalActualGasUsed: bigint;                       // sum of actual VM gas
}> {
  const outputs: AccumulateEphemeral[] = [];
  const done: Uint8Array[] = [];
  let totalActualGasUsed = 0n;

  for (const record of acceptedReports) {
    const rep = record.report;
    const repHash = rep.package_spec.hash;

    // Group report results by service id
    const serviceMap = new Map<number, any[]>();
    for (const res of rep.results) {
      const sid = res.service_id;
      const arr = serviceMap.get(sid) ?? [];
      arr.push(res);
      serviceMap.set(sid, arr);
    }

    // For each service => single VM run (12.19)
    for (const [serviceId, serviceResults] of serviceMap.entries()) {
      const reportContext = {
        packageSpec: rep.package_spec,
        authorizerHash: rep.authorizer_hash,
        authOutput: rep.auth_output,
        context: rep.context,
      };

      const ep = await accumulateSingleService(
        state,
        slot,
        serviceId,
        serviceResults,
        blockGasLimit,
        reportContext
      );

      // Collect per-service ephemeral; DO NOT mutate storage here.
      outputs.push(ep);
      totalActualGasUsed += (ep.actualGasUsed ?? 0n);
    }

    // Track this report as newly accumulated (12.21/12.23)
    if (!state.accumulated[state.accumulated.length - 1]) {
      state.accumulated.push([]);
    }
    state.accumulated[state.accumulated.length - 1].push(repHash);
    done.push(repHash);
  }

  return {
    updatedPostState: state,
    accumulatedOutputs: outputs,
    newlyAccumulatedHashes: done,
    totalActualGasUsed,
  };
}
