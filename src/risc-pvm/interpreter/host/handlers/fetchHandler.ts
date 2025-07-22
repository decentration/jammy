import { writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { WHAT, NONE } from "../consts";
import { fetchVecSelectorMap } from "../helpers";
import { HostCallHandler } from "../types";


// ΩY  – selector 18  --
export const fetchHandler: HostCallHandler = (s, _id, env) => {

    // registers on entry (spec B.6):
    // register 7  – dest - destination offset in inner‑VM memory
    // register 8  - offsetVector - offset into the vector 
    // register 9  – lenReq - length requested
    // register 10 - sel- selector n (which fetch‑vector)
    // result:
    //   r7 <- Sv   (total bytes in vector)  or  NONE/WHAT/OOB
    //   memory[dest .. dest+lenReq] updated
    const sel           = Number(s.registers[10]);
    const dest          = Number(s.registers[7]);
    const offsetVector  = Number(s.registers[8]);
    let   lenReq        = Number(s.registers[9]);
    const r             = s.registers.slice();
    const vecName       = fetchVecSelectorMap[sel];
  
    //  selector unknown
    if (!vecName) {
      r[7] = WHAT;
      return { state: { ...s, registers: r }, ok: true };
    }
  
    const vec = env.fetchVector(vecName);
  
    // vector not supplied
    if (!vec) {
      r[7] = NONE;
      return { state: { ...s, registers: r }, ok: true };
    }
  
    //  happy‑path copy
    const Sv = vec.length;
    const off = Math.min(offsetVector, Sv);  // f  in the spec
    if (lenReq === 0) lenReq = Sv - off;     // “0 -> to‑end” convenience
    const len = Math.min(lenReq, Sv - off);  // l  in the spec
  
    console.log("fetchHandler", {
      sel, dest, offsetVector, lenReq, len, Sv, off,
        vecName, vec, vecLength: vec.length,
    });

    // simple writable‑range check
    const next = writeBytes(s, dest, vec.subarray(off, off + len));

    if (next.exit?.type === ExitReasonType.PageFault) {
        // bubble the fault exactly like ΩR/ΩW do:
        return { state: next, ok: false };
      }

    r[7] = BigInt(Sv);  // return whole‑vector length
  
    return {  state: { ...s, registers: r }, ok: true };
  };
  