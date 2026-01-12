import { writeBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { NONE } from "../../consts";
import { encodeInfoHelper } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getMergedXs, getStagedOnly } from "../accumulate/helpers";

export const infoHandler: HostCallHandler = (s, _id, env) => {
  const rawId = BigInt.asUintN(64, s.registers[7]);
  const dest = Number(s.registers[8]); // destination offset (o)
  const reqF = Number(s.registers[11] ?? 0n);   // (f)
  const reqL = Number(s.registers[12] ?? 0n);   // (l)

  // branching for (a)
  const xsId = env.acc?.allocator?.env?.currentServiceId;
  const targetId = (rawId === NONE ? xsId : rawId);

  let acct: ServiceAccount | undefined;
  if (targetId === undefined) {
    acct = undefined;
  } else if (targetId !== undefined) {
    acct = getStagedOnly(env, targetId);
  }

  if (!acct) {
    // wehn v is empty, write nothing to memory
    const r = s.registers.slice();
    r[7] = NONE;
    r[6] = 0n; // conformance ABI: clear error register on success (even for NONE)
    return { state: { ...s, registers: r }, ok: true };
  }

  // encode service info (80 bytes with our helper)
  const v = (env.encodeInfo ?? encodeInfoHelper)(acct);
  const vLength = v.length;

  const f = Math.min(reqF, vLength);
  const l = Math.min(reqL, vLength - f);

  // if l > 0, attempt the write; panic on OOB (read-only / unmapped)
  let s1 = s;
  if (l > 0) {
    const next = writeBytes(s, dest, v.subarray(f, f + l));
    if (next.exit?.type === ExitReasonType.PageFault) {
      return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };
    }
    s1 = next;
  }

  // r7 ← vLength, r9 ← f, r10 ← l (GP #480 v0.7.2)
  const r = s1.registers.slice();
  r[7] = BigInt(vLength);
  r[9] = BigInt(f);   // GP #480: output clamped offset
  r[10] = BigInt(l);  // GP #480: output clamped length
  r[6] = 0n; // conformance ABI: clear error register on success
  return { state: { ...s1, registers: r }, ok: true };
};

