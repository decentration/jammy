
import { HostEnvInterface } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { executeProgram } from "../../../risc-pvm/interpreter/host/execute/executeService";
import { getServiceProgramFromState } from "../../loaders";

export interface RunServicePvmOpts {
  gas?: bigint;
  env?: HostEnvInterface;
  memSize?: number;
  args?: Uint8Array;
  preferCachedCode?: boolean;
  strictVm?: boolean;
  entryPoint?: bigint;
  overrideHost?: any;
}

export function runServicePvm(
  state: any,
  serviceId: number,
  opts: RunServicePvmOpts
) {
  const { codeHash, blob } = getServiceProgramFromState(state, serviceId);

  return executeProgram({
    codeHash,
    programBlob: blob,
    initialGas: opts.gas ?? 0n,
    env: opts.env,
    args: opts.args,
    memSize: opts.memSize,
    preferCachedCode: opts.preferCachedCode,
    strictVm: opts.strictVm,
    entryPoint: opts.entryPoint,
    overrideHost: opts.overrideHost,
  });
}
