import { readBytes, toLE } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { HASH_BYTES, SVC_ID, HUH, FULL, OK } from "../../consts";
import { finish } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getMergedXs, stageAccount } from "./helpers";

// Effect:
//   - if (h,z) not present in xs.ledger, create [] at that key
//   - if present and value is [x,y] (16 bytes), append t -> [x,y,t] (24 bytes) Otherwise HUH
//   - Guard: if updated xs.balance < at, FULL
//   - Stage updated xs into (xe).d

// ΩS – solicit (selector 23)
export const solicitHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]);  // (o)
  const z   = Number(s.registers[8]);  // (z)

  const { bytes: h, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!h) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };
  const hHex = Buffer.from(h).toString("hex");

  const xsId = env.acc?.allocator?.env?.currentServiceId ?? SVC_ID;
  const xs: ServiceAccount | undefined = getMergedXs(env);
  if (!xs) return finish(s1, HUH);

  // build updated ledger entry 
  // ledger: Map<hex32, Map<number, Uint8Array>>
  const outer = xs.ledger ?? new Map<string, Map<number, Uint8Array>>(); 
  const inner = outer.get(hHex) ?? new Map<number, Uint8Array>();
  const existing = inner.get(z); // may be undefined

  let updatedTuple: Uint8Array | undefined;
  if (!existing) {
    // (h,z) missing -> set to []
    updatedTuple = new Uint8Array(0);
  } else if (existing.length === 16) {
    // case: [x,y] -> append t -> [x,y,t]
    const t = env.now?.() ?? 0n;
    const withT = new Uint8Array(24);
    withT.set(existing, 0);
    withT.set(toLE(t, 8), 16);
    updatedTuple = withT;
  } else {
    return finish(s1, HUH);
  }

  // if a_b < a_t -> FULL
  const at = env.activationFee ?? 0n;
  if (xs.balance < at) return finish(s1, FULL);

  // stage updated xs with a cloned ledger (don’t mutate committed maps)
  const newOuter = new Map(outer);
  const newInner = new Map(inner);
  newInner.set(z, updatedTuple);
  newOuter.set(hHex, newInner);

  const updatedXs: ServiceAccount = { ...xs, ledger: newOuter };
  stageAccount(env, xsId, updatedXs);

  return finish(s1, OK);
};
