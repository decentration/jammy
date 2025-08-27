import { hash } from "../../../../utils/crypto";
import { readBytes, toLE, writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { NONE, WHO } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";
import { getMergedXs, getOverlayChangeSet, getStagedOnly } from "./accumulate/helpers";

const WILDCARD = (1n << 64n) - 1n;

export const readHandler: HostCallHandler = (s, _id, env) => {
  const srvIdxRaw = s.registers[7];         // service index
  const ko   = Number(s.registers[8]);   // key offset
  const kz   = Number(s.registers[9]);   // key length
  const dest = Number(s.registers[10]);  // μ destination
  const fOff = Number(s.registers[11]);  // value‑offset
  let   len  = Number(s.registers[12]);  // length‑requested


  const setR7 = (state: typeof s, v: bigint) => ({
      state: { ...state, registers: Object.assign([], state.registers, { 7: v }) },
      ok   : true,
    });

  const sel = BigInt.asUintN(64, srvIdxRaw);

  console.log("readHandler 1", {
      sel, ko, kz, dest, fOff, len,
      registers: s.registers.slice(),
  });

  //1. Service index check (WHO) !TODO, when support more than one service - change this. 
  if (sel !== NONE) return setR7(s, WHO);     // multi‑service unsupported yet

  console.log("readHandler 2", {
      sel, ko, kz, dest, fOff, len,
      registers: s.registers.slice(),
  });

  // 2. read key bytes from memory - panic if unmapped
  const { bytes: key, state: s1 } = readBytes(s, ko, kz);
  
  if (!key) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  
  const xsId = env.acc?.allocator?.env?.currentServiceId;
  const targetId = (sel === WILDCARD ? xsId : sel);
  
  let acct: ServiceAccount | undefined;
  if (targetId === undefined) {
    acct = undefined;
  } else if (xsId !== undefined && targetId === xsId) {
    // effective xs (prefer staged overlay if present)
    acct = getMergedXs(env);
  } else {
    // non-xs: consult staged map only
    acct = getStagedOnly(env, targetId);
  }

  if (!acct) return finish(s1, NONE);

  console.log("readHandler 2 (acct resolved)", {
    targetId,
    xsId,
    hasAcct: !!acct,
  });


  const pref = toLE(BigInt.asUintN(32, targetId ?? 0n), 4);
  const prefixedKey = new Uint8Array(pref.length + key.length);
  prefixedKey.set(pref, 0);
  prefixedKey.set(key, pref.length);

  // 3. hash the key
  const hKey = hash(prefixedKey);
  const hKeyHex = Buffer.from(hKey).toString("hex");
  // 4. Lookup in external storage
  const value = acct.storage.get(hKeyHex);
  console.log("readHandler 3", { hKeyHex, hasValue: !!value });

  if (!value) return finish(s1, NONE);  // key missing

  // 5. slice blob
  const vLength = value.length;
  const f = Math.min(fOff, vLength);
  if (len === 0) len = vLength - f;
  const slice = value.subarray(f, f + Math.min(len, vLength - f));

  // //6. TODO! storage full placeholder. (After Refine/Accumulate is complete we update this)
  // const isStoreFull = env.isFull?.() ?? false;
  // if (isStoreFull) return finish(s1, FULL);

  // 7. write bytes to destination
  const s2 = writeBytes(s1, dest, slice);
  if (s2.exit?.type === ExitReasonType.PageFault) return { state: { ...s1, exit:{type: ExitReasonType.Panic} }, ok: true };
  // 7. success!!
  const regs = s2.registers.slice();
  regs[7] = BigInt(vLength);
  return { state: { ...s2, registers: regs }, ok: true };
};