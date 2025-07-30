import { readBytes, writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { OK, OOB, WHO } from "../consts";
import { HostCallHandler } from "../types";

// PEEK (ΩK) — selector 22
export const peekHandler: HostCallHandler = (s, _id, env) => {
  const n   = Number(s.registers[7]);   // machine‑id
  const o   = Number(s.registers[8]);   // outer‑dest offset
  const src = Number(s.registers[9]);   // inner‑source offset
  const z   = Number(s.registers[10]);  // length

  const done = (st: typeof s, r7: bigint) => ({
    state: { ...st, registers: Object.assign([], st.registers, { 7: r7 }) },
    ok   : true,
  });

  const entry = env.machineTable?.get(n);
  if (!entry) return done(s, WHO);

  const innerMem: Uint8Array = entry.u.mem ?? new Uint8Array(0);
  if (src + z > innerMem.length) return done(s, OOB);

  const slice = innerMem.subarray(src, src + z);
  const s1    = writeBytes(s, o, slice);
  if (s1.exit?.type === ExitReasonType.PageFault)
    return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  return done(s1, OK);
};
