import { writeBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { NONE } from "../consts";
import { encodeInfoHelper } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";

const WILDCARD = (1n << 64n) - 1n;

export const infoHandler: HostCallHandler = (s, _id, env) => {
  const rawId = BigInt.asUintN(64, s.registers[7]);
  const dest  = Number(s.registers[8]); // destination offset (o)

  // (s) from info handler spec
  const currentServiceId = env.acc?.allocator?.env?.currentServiceId;

  // branching for (a)
  let targetId: bigint | undefined;
  if (rawId === WILDCARD) {
    targetId = currentServiceId;
  } else {
    targetId = rawId;
  }

  let acct: ServiceAccount | undefined = undefined;
  if (targetId !== undefined) {
    acct = env.getService(targetId);
  } // (t) state of service account

  // v = E(...) if a ≠ ∅, else v = ∅
  if (!acct) {
    // wehn v is empty, write nothing to memory
    const r = s.registers.slice();
    r[7] = NONE;
    return { state: { ...s, registers: r }, ok: true };
  }
  
  // encode service info (80 bytes with our helper)
  const v = (env.encodeInfo ?? encodeInfoHelper)(acct);
  const vLength = v.length;
  
  const f = Math.min(Number(s.registers[11] ?? 0n), vLength); // start slice
  const l = Math.min(Number(s.registers[12] ?? 0n), vLength - f); // end slice

  // if l > 0, attempt the write; panic on OOB (read-only / unmapped)
  let s1 = s;
  if (l > 0) {
    const next = writeBytes(s, dest, v.subarray(f, f + l));
    if (next.exit?.type === ExitReasonType.PageFault) {
      return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };
    }
    s1 = next;
  }

  // r7 <- vLength
  const r = s1.registers.slice();
  r[7] = BigInt(vLength);
  return { state: { ...s1, registers: r }, ok: true };
};

