import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { WHO, OK } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler } from "../types";

// ΩK  – invoke  (selector 25)
export const invokeHandler: HostCallHandler = (state, _id, env) => {
	const n = Number(state.registers[7]);  // machine‑id
	const o = Number(state.registers[8]);  // pointer to 112‑byte call‑blob

	const entry = env.machineTable.get(n);
	if (!entry) return finish(state, WHO);

	const { bytes, state: s1 } = readBytes(state, o, 112);
	if (!bytes)
		return { state:{ ...state, exit:{ type: ExitReasonType.Panic } }, ok:true };

	// TODO! currently stub, but eventually add "runInner function" 
	return finish(s1, OK);
};
  