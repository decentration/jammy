import { readBytes, writeBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { NONE } from "../../consts";
import { finish } from "../../helpers";
import { HostCallHandler } from "../../types";

// ΩR – read (selector 3)
export const readHandler: HostCallHandler = (s, _id, env) => {
  const selRaw = s.registers[7];         // service index
  const ko   = Number(s.registers[8]);   // key offset
  const kz   = Number(s.registers[9]);   // key length
  const dest = Number(s.registers[10]);  // μ destination
  const fOff = Number(s.registers[11]);  // value‑offset
  let   len  = Number(s.registers[12]);  // length‑requested

  // 1. read key bytes from memory - panic if unmapped
  const { bytes: key, state: s1 } = readBytes(s, ko, kz);
  
  if (!key) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  // This implementation’s STF models service storage as raw key/value pairs.
  // Resolve against the host env’s committed+staged storage map.
  const value = env.getStorage?.(key);

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
  regs[6] = 0n; // conformance ABI: clear error register on success
  return { state: { ...s2, registers: regs }, ok: true };
};