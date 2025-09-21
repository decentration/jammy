import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { C, CORE, CORES_SIZE, HUH, OK, WHO } from "../../consts";
import { finish } from "../../helpers";
import { AccEnv, HostCallHandler } from "../../types";
import { serviceExistsInAccumulate } from "./helpers";

// ΩA – assign (selector 6)
// assign handler is used to assign a core to a service.
export const assignHandler: HostCallHandler = (state, _id, env) => {
	const core_index = Number(state.registers[7]);            // (c) core index
	const off = Number(state.registers[8]);                   // (o) memory offset ptr to 32 x Q block
  const accountId = BigInt.asUintN(64, state.registers[9]); // (a) service id

	const { bytes, state: s1 } = readBytes(state, off, CORES_SIZE);
	if (!bytes) return { state:{ ...state, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // if c >= C, then finish
  if (core_index >= C) return finish(state, CORE);

  const accEnv = env.acc.allocator.env as AccEnv;
  // init if missing.
  accEnv.assignServiceAccount ??= new Map<number, bigint>();     
  accEnv.assignCore ??= new Map<number, Uint8Array>(); 

  // xs -Resolve current service xs (owner performing the assign)
  const currentServiceId = env.acc?.allocator?.env?.currentServiceId;
  if (currentServiceId === undefined) return finish(s1, WHO);

  const existingOwner = accEnv.assignServiceAccount.get(core_index)
  // if an owner exists and not xs => HUH.
  if (existingOwner !== undefined && currentServiceId !== existingOwner) {
    return finish(s1, HUH);
  }

  if (!serviceExistsInAccumulate(env, accountId)) {
    return finish(s1, WHO); // service must exist in accumulate
  }

  // if success then stage the assignment for this core
  accEnv.assignCore.set(core_index, bytes.slice());
  accEnv.assignServiceAccount.set(core_index, accountId);

  return finish(s1, OK);
};