import { WHO, HUH, OOB, OK } from "../consts";
import { HostCallHandler } from "../types";
import { finish } from "../helpers";

const MIN_PTR = 16;

// ZERO - ΩZ (selector 23)
export const zeroHandler: HostCallHandler = (state, _id, env) => {
  const n = Number(state.registers[7]); // machine id
  const p = Number(state.registers[8]); // offset
  const c = Number(state.registers[9]); // count
  
  const entry = env.machineTable.get(n);
  if (!entry) return finish(state, WHO);
  if (p < MIN_PTR) return finish(state, HUH);
  const mem = entry.u.mem;
  if (p + c > mem.length) return finish(state, OOB);

  mem.fill(0, p, p + c);
  return finish(state, OK);
};