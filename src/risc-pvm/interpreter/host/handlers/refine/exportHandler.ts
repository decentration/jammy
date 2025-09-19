import { readBytes }                 from "../../../instructions/helpers";
import { ExitReasonType }            from "../../../types";
import { FULL, OK, WG, WX }                  from "../../consts";
import { HostCallHandler }           from "../../types";


export const exportHandler: HostCallHandler = (s, _id, env) => {
  const ptr   = Number(s.registers[7]); //(p)
  let   z     = Number(s.registers[8]); // 

  z = Math.min(z, WG); // limit to segment size

  const { bytes, state: s1 } = readBytes(s, ptr, z);
  if (!bytes) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true }; // x = ∇

  const seg = new Uint8Array(WG);
  seg.set(bytes);

  const base = env.exportOffset ?? 0; // ς current base offset supplied by host
  const cur  = env.exportSegments?.length ?? 0; // (e) current export list
  if (base + cur >= WX) {
    const r = s1.registers.slice(); r[7] = FULL;
    return { state:{ ...s1, registers:r }, ok:true };
  }

  env.exportSegments ??= [];
  env.exportSegments.push(seg);

  const r = s1.registers.slice();
  r[7] = BigInt(base + cur + 1);
  return { state:{ ...s1, registers:r }, ok:true };
};
