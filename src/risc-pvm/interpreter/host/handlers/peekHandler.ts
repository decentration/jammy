import { readBytes, writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { OK, OOB, WHO } from "../consts";
import { finish } from "../helpers";
import { ensureInnerMem, innerRead } from "../innerMem/helpers";
import { InnerMachineState } from "../innerMem/types";
import { HostCallHandler } from "../types";

// PEEK (ΩK) — selector 9
export const peekHandler: HostCallHandler = (s, _id, env) => {
  const n   = Number(s.registers[7]);   // machine‑id
  const o   = Number(s.registers[8]);   // outer‑dest offset
  const src = Number(s.registers[9]);   // inner‑source offset
  const z   = Number(s.registers[10]);  // length


  const entry = env.machineTable?.get(n);
  if (!entry) return finish(s, WHO);

  const u = ensureInnerMem(entry.u);  
  const slice = innerRead(u, src, z);
  if (!slice) return finish(s, OOB);

  const s1 = writeBytes(s, o, slice);
  if (s1.exit?.type === ExitReasonType.PageFault)
    return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  return finish(s1, OK);
};
