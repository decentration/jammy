import { WHO, HUH, OOB, OK } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler } from "../types";

const MIN_PTR = 16;

// VOID - ΩV (selector 24)
export const voidHandler: HostCallHandler = (state, _id, env) => {
  const n = Number(state.registers[7]);
  const p = Number(state.registers[8]);
  const c = Number(state.registers[9]);

  const entry = env.machineTable.get(n);
  if (!entry) return finish(state, WHO);
  if (p < MIN_PTR) return finish(state, HUH);

  const mem = entry.u.mem;
  if (p + c > mem.length) return finish(state, OOB);

  for (let i = p; i < p + c; ++i) mem[i] = 0;   //  void - zero the bytes
  return finish(state, OK);
};
  