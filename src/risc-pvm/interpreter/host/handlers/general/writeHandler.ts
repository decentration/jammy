import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { NONE, WHO } from "../../consts";
import { finish } from "../../helpers";
import { HostCallHandler } from "../../types";
import { IO_BASE } from "../../../memory";

// ΩW – selector 4
export const writeHandler: HostCallHandler = (s, _id, env) => {
  
  let kOff = Number(s.registers[7]);      // (kO) key offset
  let kLen = Number(s.registers[8]);      // (kZ) key length
  let vOff = Number(s.registers[9]);      // (vO) value offset
  let vLen = Number(s.registers[10]);     // (vZ) value length (0 -> delete)

  const DBG = process.env.JAM_DEBUG_ACC === "1";
  if (DBG) {
    console.log(`[host-write] kOff=${kOff} kLen=${kLen} vOff=${vOff} vLen=${vLen} r0=${s.registers[0]} r5=${s.registers[5]} pc=${s.pc}`);
  }

  const { bytes: keyBytes, state: s1 } = readBytes(s, kOff, kLen);
  if (!keyBytes) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  // This implementation’s STF models service storage as raw key/value pairs on the service account.
  // Therefore ΩW writes are staged via env.putStorage/env.deleteStorage (consumed by applyIntermediateChanges).
  const prev = env.getStorage?.(keyBytes);
  const prevLen = prev ? BigInt(prev.length) : NONE;

  if (vLen === 0) {
    env.deleteStorage?.(keyBytes);
    return finish(s1, prevLen);
  }

  const r = readBytes(s1, vOff, vLen);
  if (!r.bytes) {
    // value bytes OOB => Panic (A.8–A.9; ΩW)
    return { state: { ...r.state, exit: { type: ExitReasonType.Panic } }, ok: true };
  }

  const xsId = env.acc?.allocator?.env?.currentServiceId;
  if (xsId === undefined) return finish(r.state, WHO);

  env.putStorage?.(keyBytes, r.bytes);
  return finish(r.state, prevLen);
};
