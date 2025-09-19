import { readBytes }               from "../../../instructions/helpers";
import { ExitReasonType }          from "../../../types";
import { OK, OOB, WHO }            from "../../consts";
import { finish }                  from "../../helpers";
import { ensureInnerMem, innerWrite } from "../../innerMem/helpers";
import { InnerMachineState } from "../../innerMem/types";
import { HostCallHandler }         from "../../types";

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
  const u: InnerMachineState = ensureInnerMem(entry.u);
  if (!innerWrite(u, dst, bytes)) return finish(s1, OOB);

  env.machineTable.set(n, { ...entry, u });

  return finish(s1, OK);
};
