import { ServiceActivityRecordCodec } from "../../codecs";
import { Report, ServiceActivityRecord, ServicesStatisticsMapEntry } from "../../types";
import { ReportsState } from "./types";

/**
 * updateStatistics:
 * updates cores_statistics and services_statistics in `postState based on
 * a newly accepted work report. 
 * GP: πC (core stats) and πS (service stats).
 * 
 * @param report The validated WorkReport from a guarantee
 * @param signaturesCount Number of validator signatures (e.g. guarantee.signatures.length)
 * @param postState The state to mutate
 */
export function updateStatistics(
    report: Report, 
    signaturesCount: number,
    postState: ReportsState
  ): void {
    // 1) identify core index
    const coreIndex = report.core_index;
  
    // Ensure postState.cores_statistics has an entry for this core
    let coreStats = postState.cores_statistics[coreIndex];
    if (!coreStats) {
      coreStats = {
        gas_used: 0,
        imports: 0,
        extrinsic_count: 0,
        extrinsic_size: 0,
        exports: 0,
        bundle_size: 0,
        da_load: 0,
        popularity: 0,
      };
      postState.cores_statistics[coreIndex] = coreStats;
    }
  
    // 2) Accumulate stats for each result item in the work report
    for (const item of report.results) {
      // i) For the core
    //   coreStats.gas_used += item.refine_load.gas_used + item.accumulate_gas;
      coreStats.imports += item.refine_load.imports;
      coreStats.extrinsic_count += item.refine_load.extrinsic_count;
      coreStats.extrinsic_size += item.refine_load.extrinsic_size;
      coreStats.exports += item.refine_load.exports;
      coreStats.bundle_size = report.package_spec.length;
  
      // TODO "da_load" maybe means total on-chain data => bundle + extrinsic size
    //   coreStats.da_load += report.package_spec.length + item.refine_load.extrinsic_size;
  
      // "popularity" could be how many validators signed
    //   coreStats.popularity += signaturesCount;
  
      // ii) For the service
      // Find or create the matching service entry in `postState.services_statistics`
      const svcId = item.service_id;
      let svcEntry: ServicesStatisticsMapEntry | undefined = postState.services_statistics.find((s) => s.id === svcId);
      if (!svcEntry) {
        svcEntry = {
          id: svcId,
          record: {
            provided_count: 0,
            provided_size: 0,
            refinement_count: 0,
            refinement_gas_used: 0,
            imports: 0,
            extrinsic_count: 0,
            extrinsic_size: 0,
            exports: 0,
            accumulate_count: 0,
            accumulate_gas_used: 0,
            on_transfers_count: 0,
            on_transfers_gas_used: 0,
          },
        };
        postState.services_statistics.push(svcEntry);
      }
  
      // 2a) update fields in ServiceActivityRecord
      svcEntry.record.refinement_count += 1;
      svcEntry.record.refinement_gas_used += item.refine_load.gas_used;
      svcEntry.record.imports += item.refine_load.imports;
      svcEntry.record.extrinsic_count += item.refine_load.extrinsic_count;
      svcEntry.record.extrinsic_size += item.refine_load.extrinsic_size;
      svcEntry.record.exports += item.refine_load.exports;
  
      // TODO: 
      // provided_count / provided_size / on_transfers_* / 
      // accumulate_count / accumulate_gas_used / 
      // 
      // in core_statistics da_load / popularity
      // 
      // may be updated elsewhere waiting for version updates. 
    }
  }
  