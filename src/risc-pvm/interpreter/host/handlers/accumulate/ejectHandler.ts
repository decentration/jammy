import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { HASH_BYTES, SVC_ID, WHO, HUH, OK, D } from "../../consts";
import { finish, readU64LE } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getMergedXs, getStagedOnly, stageAccount, stageTombstone } from "./helpers";

// ΩJ – eject (selector 21)
// 0.7.1
//
// INPUTS:
//   r7 = (d) candidate service id to eject (must NOT be the current service)
//   r8 = (o) pointer to 32-byte hash (h)
// DERIVED:
//   h = μ[o..o+32) memory read from o and o+32; panic if unmapped
//   d = (xe)d[d] if d != xs and service exists, else panic. 
//       - (xe)d[d] is the candidate service account if d != current service id
//   l = max(81, d.o) − 81 (we model d.o via ServiceAccount.coresOffset)
// GATES:
//   WHO if d = ∇ OR d.c != E32(xs) (same rootCodeHash required)
//   HUH if d.i != 2 OR (h,l) ∉ d.l  (we model d.i as optional `status`, default 2;
//                                    we model d.l via lookupStorage keyed by (h,l))
//   OK if d.l[h,l] = [x,y] and y < t − D 
// EFFECT:
//   s' = xs except s'_b = xs.b + d.b
//   (xe)d  := (xe)d \ { d } ∪ { (xs ↦ s') } 
//     - (xe)d  := (xe)d means the service account mapping in the accumulator env
//     - \ { d } is removal of the candidate service id (d) from the mapping
//     - ∪ { (xs ↦ s') } is addition of the updated current service id (xs) with new balance

// in this persistence model, we cannot delete a service id, so we zero out d.balance.
const EJECT_DELAY = BigInt(D);

export const ejectHandler: HostCallHandler = (s, _id, env) => {
  const ejectId = BigInt.asUintN(64, s.registers[7]); // (d) candidate service id to ejec
  const off = Number(s.registers[8]);                 // (o) pointer to 32-byte hash (h)

  // read 32 byte hash h from memory
  const { bytes: h, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!h) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  const xe = env.acc?.allocator?.env!;
  const currentServiceId = xe.currentServiceId ?? SVC_ID;  
  const xs = getMergedXs(env); // merged (staged over committed)
  if (!xs) return finish(s1, WHO);

  // candidate service must exist.
  if (ejectId === currentServiceId) return finish(s1, WHO);
  const dService = getStagedOnly(env, ejectId);
  if (!dService) return finish(s1, WHO);

  if (dService.rootCodeHash !== xs.rootCodeHash) return finish(s1, WHO);

  // l = max(81, d.o) − 81 ; d.o via coresOffset (default 81 -> l=0).
  const dOff = dService.coresOffset ?? 81;
  const l = Math.max(81, dOff) - 81; //(l) 

  const role = xe.designationEntries?.get(ejectId)?.role ?? 2;
  if (role !== 2) return finish(s1, HUH);

  // (h,l) is element of d.l gate:
  const hHex = Buffer.from(h).toString("hex");
  const tuple = dService.ledger?.get(hHex)?.get(l);

  // if no tuple or malformed, (h,l) not element of d.l
  if (!tuple || tuple.length < 16)  return finish(s1, HUH);

  const x = readU64LE(tuple, 0);  // unused, but decoded for completeness
  const y = readU64LE(tuple, 8);

  // y < t − D gate
  const t = env.now?.() ?? 0n;
  if (!(y < (t - EJECT_DELAY))) return finish(s1, HUH);

  // s' = xs except s'_b = xs.b + d.b
  const newXs: ServiceAccount = { ...xs, balance: xs.balance + dService.balance };

  stageAccount(env, currentServiceId, newXs);
  stageTombstone(env, ejectId);

  return finish(s1, OK);
};
