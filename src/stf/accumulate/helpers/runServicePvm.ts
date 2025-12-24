import { executeProgram } from "../../../risc-pvm/interpreter/host/execute/executeService";
import { invalidatePrepared } from "../../../risc-pvm/interpreter/host/execute/helpers";
import { HostEnvInterface, makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { makeMemory } from "../../../risc-pvm/interpreter/memory";
import { getServiceProgramFromState } from "../../loaders";

export type RunServicePvmOpts = {
  gas?: bigint;        // per-chunk gas budget
  memSize?: number;    // default 1 MiB
  args?: Uint8Array;   // Y(p,a): |a|<= ZI
  preferCachedCode?: boolean; // default true
  env?: HostEnvInterface;
  strictVm?: boolean
};

const DEFAULT_MEM = 1 << 20;        // 1 MiB
const IO_WINDOW_BYTES = 0x20000;    // 128 KiB for FEFE/FEFF

export function runServicePvm(preState: any, serviceId: number, opts: RunServicePvmOpts = {}) {
  const { codeHash, blob } = getServiceProgramFromState(preState, serviceId);
  const env = opts.env ?? makeHostEnv();

  // Allocate heap and create our interface-based Memory.
  const heapBytes = new Uint8Array(opts.memSize ?? DEFAULT_MEM);
  const memory = makeMemory(heapBytes, env);

  if (!env.ioBuffer || env.ioBuffer.length !== IO_WINDOW_BYTES) {
    env.ioBuffer = new Uint8Array(IO_WINDOW_BYTES);
  }


  return executeProgram({
    codeHash,
    programBlob: blob,
    initialGas: opts.gas ?? 0n,
    memSize: opts.memSize ?? (1 << 20),
    args: opts.args ?? new Uint8Array(),
    preferCachedCode: opts.preferCachedCode ?? true,
    env: opts.env ?? undefined,
    memory,

    strictVm: opts.strictVm ?? false,
    
  });
}

export function invalidateServicePvm(codeHash: Uint8Array) {
  invalidatePrepared(codeHash);
}
