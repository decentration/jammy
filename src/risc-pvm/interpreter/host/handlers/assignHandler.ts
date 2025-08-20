import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { C, CORE, CORES_SIZE, HUH, OK, WHO } from "../consts";
import { finish } from "../helpers";
import { AccEnv, HostCallHandler } from "../types";

// ΩA – assign (selector 6)
// assign handler is used to assign a core to a service.
export const assignHandler: HostCallHandler = (state, _id, env) => {
	const core_index = Number(state.registers[7]);            // (c) core index
	const off = Number(state.registers[8]);                   // (o) memory offset ptr to 32 x Q block
  const accountId = BigInt.asUintN(64, state.registers[9]); // (a) service id

	const need = CORES_SIZE;

	const { bytes, state: s1 } = readBytes(state, off, need);
	if (!bytes) return { state:{ ...state, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // if c >= C, then finish
  if (core_index >= C) return finish(state, CORE);

  // xs -Resolve current service xs (owner performing the assign)
  const currentServiceId = env.acc?.allocator?.env?.currentServiceId;

  const accEnv = env.acc.allocator.env as AccEnv;
  // init if missing.
  accEnv.assignServiceAccount ??= new Map<number, bigint>();     
  accEnv.assignCore ??= new Map<number, Uint8Array>(); 

  // if an owner exists and not xs => HUH.
  if (accEnv.assignServiceAccount.has(core_index) && currentServiceId !== accEnv.assignServiceAccount.get(core_index)) {
    return finish(s1, HUH);
  }

  // treat “valid service id” as “present in env”
  if (!env.hasService?.(accountId)) {
    return finish(s1, WHO);
  }

  // if success then stage the assignment for this core
  accEnv.assignCore.set(core_index, bytes.slice());
  accEnv.assignServiceAccount.set(core_index, accountId);

  return finish(s1, OK);
};