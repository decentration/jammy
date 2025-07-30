import { writeBytes }                 from "../../instructions/helpers";
import { ExitReasonType }             from "../../types";
import { NONE, OK, WHO }              from "../consts";
import { finish }                     from "../helpers";
import { HostCallHandler }            from "../types";

export const infoHandler: HostCallHandler = (s, _id, env) => {
  const srvIdx = BigInt.asUintN(64, s.registers[7]);
  const dest    = Number(s.registers[8]); // destination offset (o)

  if (srvIdx !== NONE && !env.hasService?.(srvIdx)) return finish(s, WHO);

  const info = env.getInfo?.(srvIdx) ?? null; // (t) state of service account
  if (!info) return finish(s, NONE);

  const m = env.encodeInfo?.(info) ?? new Uint8Array(); // encoding of srvice accounts
  const s1 = writeBytes(s, dest, m);
  if (s1.exit?.type === ExitReasonType.PageFault) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  return finish(s1, OK);
};
