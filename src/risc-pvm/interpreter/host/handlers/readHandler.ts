import { readBytes, writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { FULL, NONE, OOB, WHO } from "../consts";
import { HostCallHandler } from "../types";

export const readHandler: HostCallHandler = (s, _id, env) => {
    const srvIdx = s.registers[7];         // service index
    const ko   = Number(s.registers[8]);   // key offset
    const kz   = Number(s.registers[9]);   // key length
    const dest = Number(s.registers[10]);  // μ destination
    const fOff = Number(s.registers[11]);  // value‑offset
    let   len  = Number(s.registers[12]);  // length‑requested
  
    // helper for ‘early‑return with constant’
    const done = (state: typeof s, constant: bigint) => ({
        state : { ...state, registers: Object.assign([], state.registers, { 7: constant }) },
        ok    : true,
        exit  : { type: ExitReasonType.Continue },
    });
    console.log("readHandler 1", {
        srvIdx, ko, kz, dest, fOff, len,
        registers: s.registers.slice(),
    });

    //1. Service index check (WHO) !TODO, when support more than one service - change this. 
    if (srvIdx !== - 1n) return done(s, WHO);     // multi‑service unsupported yet

    console.log("readHandler 2", {
        srvIdx, ko, kz, dest, fOff, len,
        registers: s.registers.slice(),
    });

    // 2. read key bytes from memory - OOB if unmapped
    const { bytes: key, state: s1 } = readBytes(s, ko, kz);
    if (!key) return done(s1, OOB);

    // 3. Lookup in external storage
    const value = env.getStorage?.(key);

    console.log("readHandler 3", { value });
  
    if (!value) return done(s1, NONE);  // key missing

  
    // 4. slice blob
    const Sv = value.length;
    const f = Math.min(fOff, Sv);
    if (len === 0) len = Sv - f;
    const slice = value.subarray(f, f + Math.min(len, Sv - f));

    //5. TODO! storage full placeholder. (After Refine/Accumulate is complete we update this)
    if (false /* env.isFull?.() */)   return done(s1, FULL);

    // 6. write bytes to destination
    const s2 = writeBytes(s1, dest, slice);
    if (s2.exit?.type === ExitReasonType.PageFault) return done(s2, OOB);

    // 7. success!!
    const regs = s2.registers.slice();
    regs[7] = BigInt(Sv);
    return { state: { ...s2, registers: regs }, ok: true };
  };