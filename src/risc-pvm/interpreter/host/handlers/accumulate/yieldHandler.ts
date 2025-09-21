import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { HASH_BYTES, OK } from "../../consts";
import { finish } from "../../helpers";
import { AccumulateY, HostCallHandler } from "../../types";

// ΩY – yield (selector 25)
export const yieldHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]); // (o)

  const { bytes: h, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!h) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  // write h into the y (session) of the accumulation context
  const sess = env.acc?.session as AccumulateY;
  if (sess) {
    sess.yield = h.slice(); // store copy in yeld
  }

  return finish(s1, OK);
};
