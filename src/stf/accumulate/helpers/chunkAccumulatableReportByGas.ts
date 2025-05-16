import { ReadyRecord } from "../types";

export function chunkAccumulatableReportsByGas(
    allReports: ReadyRecord[],
    blockGasLimit: number
  ): {
    acceptedReports: ReadyRecord[],
    leftoverReports: ReadyRecord[],
  } {
    let usedGas = 0;

    const acceptedReports: ReadyRecord[] = [];
    const leftoverReports: ReadyRecord[] = [];
  
    for (const record of allReports) {
      const rep = record.report;
  
      // sum accumulate_gas across all results
      const totalAccGas = rep.results.reduce(
        (sum, r) => sum + (r.accumulate_gas ?? 0), 0
      );
  
      if (usedGas + totalAccGas <= blockGasLimit) {
        acceptedReports.push(record);
        usedGas += totalAccGas;
      } else {
        leftoverReports.push(record);
      }
    }
  
    return { acceptedReports, leftoverReports };
  }
  