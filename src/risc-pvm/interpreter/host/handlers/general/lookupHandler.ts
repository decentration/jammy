import { readBytes, writeBytes }      from "../../../instructions/helpers";
import { ExitReasonType }             from "../../../types";
import { NONE, WHO, WILDCARD }                  from "../../consts";
import { finish }                     from "../../helpers";
import { HostCallHandler }            from "../../types";
import { getMergedXs, getStagedOnly } from "../accumulate/helpers";

// LOOKUP (ΩL) — selector 1
export const lookupHandler: HostCallHandler = (s, _id, env) => {
  const req = BigInt.asUintN(64, s.registers[7]); // service index (s)
  const hOff   = Number(s.registers[8]); // output offset of the hash to lookup
  const dest   = Number(s.registers[9]); // dest memory offset to copy preimage to
  const fOff   = Number(s.registers[10]); // offset into found preimage
  let len      = Number(s.registers[11]); // number of  bytes to copy from the preimage

  const { bytes: hashBytes, state: s1 } = readBytes(s, hOff, 32);
  if (!hashBytes) return { state: { ...s, exit:{ type: ExitReasonType.Panic } }, ok: true };
  
  const xsId   = env.acc?.allocator?.env?.currentServiceId;
  const target = (req === WILDCARD ? xsId : req);



  let accountExists = false;
  if (target === undefined) {
    accountExists = false;
  } else if (req === WILDCARD) {
    // wildcard => xs
    accountExists = !!getMergedXs(env);   // merged (staged over committed)
  } else {
    // explicit id => staged-only during accumulate
    accountExists = !!getStagedOnly(env, req);
  }

  if (!accountExists) return finish(s1, NONE);  // if a is missing then NONE
  
  const value = env.lookupPreimage?.(hashBytes);
  if (!value) return finish(s1, NONE); // if ap[...] is missing then NONE

  const vLength = value.length; // Service size
  const f  = Math.min(fOff, vLength); // Offset into the found preimage blob
  if (len === 0) len = vLength - f;
  const slice = value.subarray(f, f + Math.min(len, vLength - f));

  const s2 = writeBytes(s1, dest, slice);
  if (s2.exit?.type === ExitReasonType.PageFault) return { state: { ...s1, exit:{ type: ExitReasonType.Panic } }, ok: true };

  const regs = s2.registers.slice();
  regs[7] = BigInt(vLength);
  return { state: { ...s2, registers: regs }, ok: true };
};