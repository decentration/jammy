import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { NONE, WHO, FULL, BI, BL, BS } from "../../consts";
import { computeThresholdAfterWrite, finish, computeThresholdBalance } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";
import { IO_BASE } from "../../../memory";
import { coerceU64 } from "../../../../../codecs";
import { getMergedXs } from "../accumulate/helpers";


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

  const keyHex = Buffer.from(keyBytes).toString("hex");

  // Get previous value (if exists)
  const prev = env.getStorage?.(keyBytes);
  const prevLen = prev ? coerceU64(prev.length) : NONE;

  // Delete case (vLen = 0) - no threshold check needed (reduces footprint)
  if (vLen === 0) {
    env.deleteStorage?.(keyBytes);
    return finish(s1, prevLen);
  }

  // Read the new value
  const r = readBytes(s1, vOff, vLen);
  if (!r.bytes) {
    // value bytes OOB => Panic (A.8–A.9; ΩW)
    return { state: { ...r.state, exit: { type: ExitReasonType.Panic } }, ok: true };
  }

  const xsId = env.acc?.allocator?.env?.currentServiceId;
  if (xsId === undefined) return finish(r.state, WHO);

  // Compute the threshold balance that would result from this write
  // and verify the account balance can cover it
  const xs = getMergedXs(env);
  if (xs) {
    const newThreshold = computeThresholdAfterWrite(xs, keyHex, prev, r.bytes);

    if (xs.balance < newThreshold) {
      if (DBG) {
        const currentThreshold = computeThresholdBalance(xs);
        console.log(`[host-write] FULL: balance=${xs.balance} < newThreshold=${newThreshold} (current=${currentThreshold})`);
      }
      return finish(r.state, FULL);
    }
  }


  env.putStorage?.(keyBytes, r.bytes);
  return finish(r.state, prevLen);
};
