import { executeProgram } from "../../../risc-pvm/interpreter/host/execute/executeService";
import { invalidatePrepared } from "../../../risc-pvm/interpreter/host/execute/helpers";
import { HostEnvInterface, makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { makeMemory } from "../../../risc-pvm/interpreter/memory";
import { HostDispatcher } from "../../../risc-pvm/interpreter/host/types";
import { getServiceProgramFromState } from "../../loaders";
import { tryLoadServiceBlobForService } from "./loaders";
import { asU8 } from "../../../utils";

export type RunServicePvmOpts = {
  gas?: bigint;        // per-chunk gas budget
  memSize?: number;    // default 1 MiB
  args?: Uint8Array;   // Y(p,a): |a|<= ZI
  preferCachedCode?: boolean; // default true
  env?: HostEnvInterface;
  strictVm?: boolean;
  entryPoint?: bigint; // entry point selector (5=refine, 12=accumulate, 15=on_transfer)
  overrideHost?: HostDispatcher;
};

const DEFAULT_MEM = 1 << 20;        // 1 MiB
const IO_WINDOW_BYTES = 0x20000;    // 128 KiB for FEFE/FEFF

export function runServicePvm(preState: any, serviceId: number, opts: RunServicePvmOpts = {}) {
  // Try cross-account preimage lookup first (for shared code blobs)
  const accounts = preState.accounts ?? preState.data?.accounts ?? [];
  const svc = accounts.find((x: any) => x.id === serviceId);
  if (!svc) throw new Error("service not found");

  const codeHash = asU8(svc.data?.service?.code_hash ?? svc.service?.code_hash ?? svc.code_hash);

  // Use cross-account loader that searches all accounts preimages
  let blob = tryLoadServiceBlobForService(preState, serviceId, codeHash);

  // Fallback to original loader if cross-account search fails
  if (!blob) {
    const result = getServiceProgramFromState(preState, serviceId);
    blob = result.blob;
  }

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
    entryPoint: opts.entryPoint,  // entry point selector for service invocation
    overrideHost: opts.overrideHost,
  });
}

export function invalidateServicePvm(codeHash: Uint8Array) {
  invalidatePrepared(codeHash);
}
