import { coerceU64 } from "../../codecs";
import { Gas } from "../../types";
import { ReadyRecord } from "./types";

export function chunkAccumulatableReportsByGas(
    allReports: ReadyRecord[],
    blockGasLimit: Gas
  ): {
    acceptedReports: ReadyRecord[],
    leftoverReports: ReadyRecord[],
  } {
    let usedGas: Gas = 0n;

    const acceptedReports: ReadyRecord[] = [];
    const leftoverReports: ReadyRecord[] = [];
  
    for (const record of allReports) {
      const rep = record.report;
  
      // sum accumulate_gas across all results
      const totalAccGas = rep.results.reduce(
        (sum, r) => sum + (coerceU64(r.accumulate_gas) ?? 0n), 0n
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
  