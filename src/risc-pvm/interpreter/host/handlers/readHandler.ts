import { hash } from "../../../../utils/crypto";
import { readBytes, toLE, writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { NONE, WHO } from "../consts";
import { HostCallHandler } from "../types";

export const readHandler: HostCallHandler = (s, _id, env) => {
    const srvIdxRaw = s.registers[7];         // service index
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

    const setR7 = (state: typeof s, v: bigint) => ({
        state: { ...state, registers: Object.assign([], state.registers, { 7: v }) },
        ok   : true,
      });

    const srvIdx    = BigInt.asUintN(64, srvIdxRaw);

    console.log("readHandler 1", {
        srvIdx, ko, kz, dest, fOff, len,
        registers: s.registers.slice(),
    });

    //1. Service index check (WHO) !TODO, when support more than one service - change this. 
    if (srvIdx !== NONE) return setR7(s, WHO);     // multi‑service unsupported yet

    console.log("readHandler 2", {
        srvIdx, ko, kz, dest, fOff, len,
        registers: s.registers.slice(),
    });

    // 2. read key bytes from memory - panic if unmapped
    const { bytes: key, state: s1 } = readBytes(s, ko, kz);
    
    if (!key) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

    const pref = toLE(srvIdx & 0xffff_ffffn, 4);
    const prefixedKey = new Uint8Array(pref.length + key.length);
    prefixedKey.set(pref, 0);
    prefixedKey.set(key, pref.length);
    
    // 3. hash the key
    const hKey = hash(prefixedKey);
    // 4. Lookup in external storage
    const value = env.getStorage?.(hKey);
    console.log("readHandler 3", { hKey, value, key, prefixedKey });
  
    if (!value) return done(s1, NONE);  // key missing

    // 5. slice blob
    const Sv = value.length;
    const f = Math.min(fOff, Sv);
    if (len === 0) len = Sv - f;
    const slice = value.subarray(f, f + Math.min(len, Sv - f));

    // //6. TODO! storage full placeholder. (After Refine/Accumulate is complete we update this)
    // const isStoreFull = env.isFull?.() ?? false;
    // if (isStoreFull) return done(s1, FULL);

    // 7. write bytes to destination
    const s2 = writeBytes(s1, dest, slice);
    if (s2.exit?.type === ExitReasonType.PageFault) return { state: { ...s1, exit:{type: ExitReasonType.Panic} }, ok: true };
    // 7. success!!
    const regs = s2.registers.slice();
    regs[7] = BigInt(Sv);
    return { state: { ...s2, registers: regs }, ok: true };
  };