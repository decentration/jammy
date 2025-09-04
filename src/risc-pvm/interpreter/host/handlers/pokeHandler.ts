import { readBytes }               from "../../instructions/helpers";
import { ExitReasonType }          from "../../types";
import { OK, OOB, WHO }            from "../consts";
import { finish }                  from "../helpers";
import { HostCallHandler, InnerMachineState }         from "../types";

// PEEK (ΩK) — selector 10
export const pokeHandler: HostCallHandler = (s, _id, env) => {
  const n   = Number(s.registers[7]);   // machine‑id
  const src = Number(s.registers[8]);   // outer‑source offset
  const dst = Number(s.registers[9]);   // inner‑dest  offset
  const z   = Number(s.registers[10]);  // length


  const entry = env.machineTable?.get(n);
  if (!entry) return finish(s, WHO);

  const { bytes, state: s1 } = readBytes(s, src, z);
  if (!bytes) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // grow inner memory if needed
  const u: InnerMachineState = entry.u;

  // out of bounds on the inner side -> OOB
  if (dst + z > u.v.length) return finish(s1, OOB);
  u.v.set(bytes, dst);

  return finish(s1, OK);
};
