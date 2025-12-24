import { MapPlanEntry } from "../../initializer/types";
import { runBlob } from "../../runBlob";
import { InterpreterState } from "../../types";
import { prepareProgram } from "../prepareProgram";
import { ExecOpts } from "../types";
import { preferCache } from "./helpers";

// for testing and fuzzing
type UnsafeOverrides = Partial<{ // ommitable parameters 
  registers: bigint[];
  memInit: Uint8Array;
  heapStart: number;
  heapEnd: number;
  mapPlan: MapPlanEntry[];
}> & { force?: boolean }; // allow unsafe overrides on standard container

export function executeProgramDebug(opts: ExecOpts, overrides: UnsafeOverrides): InterpreterState {
  const { via, init } = prepareProgram(opts.programBlob, opts.memSize ?? (1<<20), opts.args ?? new Uint8Array());

  // Guard spec path unless force=true
  if (via === "standard" && !overrides.force) {
    if (overrides.heapStart !== undefined || overrides.heapEnd !== undefined ||
        overrides.mapPlan !== undefined || overrides.registers !== undefined ||
        overrides.memInit !== undefined) {
      throw new Error("Overrides on standard container require { force: true }");
    }
  } 

  const code = preferCache(opts.codeHash, init.code, opts.preferCachedCode ?? true);
  
  return runBlob(code, opts.initialGas ?? 10_000n, {
    env: opts.env, overrideHost: opts.overrideHost, memSize: opts.memSize ?? (1<<20),
    heapStart: overrides.heapStart ?? init.heapStart,
    heapEnd:   overrides.heapEnd   ?? init.heapEnd,
    memInit:   overrides.memInit   ?? init.memInit,
    registers: overrides.registers ?? init.registers,
    mapPlan:   overrides.mapPlan   ?? init.mapPlan,
  });
}



