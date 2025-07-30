import { readBytes }               from "../../instructions/helpers";
import { ExitReasonType }          from "../../types";
import { OK, OOB, WHO }            from "../consts";
import { HostCallHandler }         from "../types";

// PEEK (ΩK) — selector 21
export const pokeHandler: HostCallHandler = (s, _id, env) => {
  const n   = Number(s.registers[7]);   // machine‑id
  const src = Number(s.registers[8]);   // outer‑source offset
  const dst = Number(s.registers[9]);   // inner‑dest  offset
  const z   = Number(s.registers[10]);  // length

  const done = (st: typeof s, r7: bigint) => ({
    state: { ...st, registers: Object.assign([], st.registers, { 7: r7 }) },
    ok   : true,
  });

  const entry = env.machineTable?.get(n);
  if (!entry) return done(s, WHO);

  const { bytes, state: s1 } = readBytes(s, src, z);
  if (!bytes) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // grow inner memory if needed
  const inner = entry.u.mem ?? new Uint8Array(0);

  // out of bounds on the inner side -> OOB
  if (dst + z > inner.length) return done(s1, OOB);
  inner.set(bytes, dst);

  return done(s1, OK);
};
