import { readBytes, toLE } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { D, HUH, OK } from "../../consts";
import { finish, readU64LE } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getMergedXs, stageAccount } from "./helpers";


const FORGET_DELAY = D;

// ΩF – forget (selector 24)
export const forgetHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]);                     // (o) - ptr to 32B hash
  const z   = Number(BigInt.asUintN(32, s.registers[8])); // (z) - ledger index

  const { bytes: h, state: s1 } = readBytes(s, off, 32);
  if (!h) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };
  const hHex = Buffer.from(h).toString("hex");

  const xs = getMergedXs(env);
  if (!xs) return finish(s1, HUH);

  const tNow = env.now?.() ?? 0n;

  // clone nested ledger map for staging
  const ledger = xs.ledger ?? new Map<string, Map<number, Uint8Array>>();
  const newLedger = new Map<string, Map<number, Uint8Array>>(ledger);

  // grab inner map for this hHex and clone if present
  const inner = ledger.get(hHex);
  const innerNew = inner ? new Map<number, Uint8Array>(inner) : undefined;

  // if no entry then
  const tuple = innerNew?.get(z);
  if (!tuple) return finish(s1, HUH);

  // Decode tuple by length (0 => [], 8 => [x], 16 => [x,y], 24 => [x,y,z]).
  const len = tuple.length;

  // a local function to delete (h,z) and remove h from preimages
  const toDelete = () => {
    // remove (h,z) from ledger
    if (innerNew) {
      innerNew.delete(z);
      if (innerNew.size === 0) {
        newLedger.delete(hHex);
      } else {
        newLedger.set(hHex, innerNew);
      }
    }
    // remove h from preimages key-set
    const newPre = new Map(xs.preimages);
    newPre.delete(hHex);

    // stage updated xs (ledger + preimages).
    const updated: ServiceAccount = { ...xs, ledger: newLedger, preimages: newPre };
    stageAccount(env, env.acc.allocator.env.currentServiceId!, updated);
  };

  // set (h,z) to [a,b]
  const setTwo = (a: bigint, b: bigint) => { 
    const enc = new Uint8Array(16); //[u64a, u64b]
    enc.set(toLE(a, 8), 0);
    enc.set(toLE(b, 8), 8);
    if (!innerNew) {
      // should not happen because tuple existed
      const m = new Map<number, Uint8Array>();
      m.set(z, enc);
      newLedger.set(hHex, m);
    } else {
      innerNew.set(z, enc);
      newLedger.set(hHex, innerNew);
    }
    const updated: ServiceAccount = { ...xs, ledger: newLedger };
    stageAccount(env, env.acc.allocator.env.currentServiceId!, updated);
  };

  if (len === 0) {
    // [] -> delete (h,z) and remove h from preimages
    toDelete();
    return finish(s1, OK);
  }

  if (len === 8) {
    // [x] -> set [x, t]
    const x = readU64LE(tuple, 0);
    setTwo(x, tNow);
    return finish(s1, OK);
  }

  if (len === 16) {
    // [x, y] -> if y < t-D then delete pair + remove h from preimages; else HUH.
    const _x = readU64LE(tuple, 0); // we dont use for delete case
    const y  = readU64LE(tuple, 8);
    if (y < (tNow - BigInt(FORGET_DELAY))) {
      toDelete();
      return finish(s1, OK);
    }
    return finish(s1, HUH);
  }

  if (len === 24) {
    // [x, y, w] -> if y < t-D then set [w, t]; else HUH.
    const _x = readU64LE(tuple, 0);
    const y  = readU64LE(tuple, 8);
    const w  = readU64LE(tuple, 16);
    if (y < (tNow - BigInt(FORGET_DELAY))) {
      setTwo(w, tNow);
      return finish(s1, OK);
    }
    return finish(s1, HUH);
  }

  return finish(s1, HUH);
};