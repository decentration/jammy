import { runBlob } from "../../runBlob";
import { InterpreterState } from "../../types";
import { prepareProgram } from "../prepareProgram";
import { ExecOpts } from "../types";
import { preferCache } from "./helpers";

const MIN_INITIAL_GAS = 1n;

export function executeProgram(opts: ExecOpts): InterpreterState {


  if (opts.initialGas < MIN_INITIAL_GAS) {
    throw new Error(`initialGas must be >= ${MIN_INITIAL_GAS}`);
  }

  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log("[executeProgram] strictVm in ExecOpts =", opts.strictVm);
  }

  
  const { init } = prepareProgram(opts.programBlob, opts.memSize ?? (1<<20), opts.args ?? new Uint8Array());
  const code = preferCache(opts.codeHash, init.code, opts.preferCachedCode ?? true);

  return runBlob(code, opts.initialGas, {
    env: opts.env, 
    overrideHost: opts.overrideHost, 
    strictVm: opts.strictVm ?? true,
    memory: opts.memory,
    memSize: opts.memSize ?? (1<<20),
    heapStart: init.heapStart, 
    heapEnd: init.heapEnd, 
    memInit: init.memInit,
    registers: init.registers, 
    mapPlan: init.mapPlan,
    args: opts.args, // Pass args to runBlob so they can be copied to args band
    stackSizeBytes: 'stackSizeBytes' in init ? (init as any).stackSizeBytes : undefined, // Pass stack size if available
    entryPoint: opts.entryPoint, // Entry point selector for service invocation
  });
}


