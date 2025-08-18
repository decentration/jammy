import { writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { WHAT, NONE } from "../consts";
import { buildFetchConfigVector } from "../helpers";
import { FetchSel, fetchVecSelectorMap, HostCallHandler } from "../types";


// ΩY  – selector 1  --
export const fetchHandler: HostCallHandler = (s, _id, env) => {

    // registers on entry (spec B.6):
    // register 7  – dest - destination offset in inner‑VM memory
    // register 8  - offsetVector - offset into the vector 
    // register 9  – lenReq - length requested
    // register 10 - sel- selector n (which fetch‑vector)
    // result:
    //   r7 <- vLength   (total bytes in vector)  or  NONE/WHAT/OOB
    //   memory[dest .. dest+lenReq] updated
    const dest          = Number(s.registers[7]); 
    const offsetVector  = Number(s.registers[8]);
    let   lenReq        = Number(s.registers[9]);
    const sel           = Number(s.registers[10]); 
    const r             = s.registers.slice();

    // config logic as a special case
    if (sel === FetchSel.Config) {
      const v = buildFetchConfigVector();
      const vLength = v.length;
      const f = Math.min(offsetVector, vLength);
      if (lenReq === 0) lenReq = vLength - f;
      const l = Math.min(lenReq, vLength - f);
      const next = writeBytes(s, dest, v.subarray(f, f + l));
      if (next.exit?.type === ExitReasonType.PageFault) return { state: next, ok: false, exit: { type: ExitReasonType.Panic } };
      r[7] = BigInt(vLength);
      return { state: { ...s, registers: r }, ok: true };
    }
  
    const vecName = fetchVecSelectorMap[sel];
    if (!vecName) { r[7] = NONE; return { state: { ...s, registers: r }, ok: true }; }

    const vec = env.fetchVector(vecName);
    if (!vec) { r[7] = NONE; return { state: { ...s, registers: r }, ok: true }}
  
    //  happy‑path copy
    const vLength = vec.length;
    const off = Math.min(offsetVector, vLength);  // f  in the spec
    if (lenReq === 0) lenReq = vLength - off;     // “0 -> to‑end” convenience
    const len = Math.min(lenReq, vLength - off);  // l  in the spec

    // simple writable‑range check
    const next = writeBytes(s, dest, vec.subarray(off, off + len));

    if (next.exit?.type === ExitReasonType.PageFault) {
      return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };
    }

    r[7] = BigInt(vLength);  // return whole‑vector length
  
    return {  state: { ...s, registers: r }, ok: true };
  };
  