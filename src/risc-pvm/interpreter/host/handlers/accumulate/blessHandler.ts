import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { WHO, OK, SVC_ID, BYTES_PER_BLESS_HASH, MAX_BLESS_SELECTOR_SLOTS } from "../../consts";
import { finish } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getMergedXs, getOverlayChangeSet, stageAccount } from "./helpers";

// ΩB – bless  (selector 5)
// bless handler is used to register a service with a set of selector-hash pairs.
export const blessHandler: HostCallHandler = (state, _id, env) => {
  const selectorSlot = Number(state.registers[7]); // (m) index into the service method slot
  const authSlot = Number(state.registers[8]);     // (a) index into the service authorisation slot
  const versionSlot = Number(state.registers[9]);  // (v) index into the service version slot 
  const off = Number(state.registers[10]);         // (o) memory offset where the list of service hash pairs starts
  const len = Number(state.registers[11]);         // (n) the count of how many 12-byte pairs to read

  if (selectorSlot >= MAX_BLESS_SELECTOR_SLOTS || authSlot >= MAX_BLESS_SELECTOR_SLOTS || versionSlot >= MAX_BLESS_SELECTOR_SLOTS) return finish(state, WHO);

  // check if we have enough bytes to read. 
  // 12 bytes per bless hash, so 8 bytes for the hash and 4 bytes for the selector.
  const need = BYTES_PER_BLESS_HASH * len;

  const { bytes, state: s1 } = readBytes(state, off, need); // g, derive
  if (!bytes) return { state:{ ...state, exit:{ type: ExitReasonType.Panic } }, ok:true };

    // xs required in accumulate context
    const xsId = env.acc?.allocator?.env?.currentServiceId;
    if (xsId === undefined) return finish(s1, WHO);

    const cur  = getMergedXs(env) ?? {
    storage: new Map(), preimages: new Map(), lookupStorage: new Map(),
    rootCodeHash: 0n, balance: 0n, gasAccumulate: 0n, gasOnTransfer: 0n,
    cores: new Uint8Array(32 * 8), selectorMap: new Map(),
  } as ServiceAccount;

  const next: ServiceAccount = { ...cur, selectorMap: new Map(cur.selectorMap) };

  for (let i = 0; i < len; i++) {
    const base = i * BYTES_PER_BLESS_HASH;
    const sel  = bytes[base] | (bytes[base+1]<<8) | (bytes[base+2]<<16) | (bytes[base+3]<<24);
    const hash = bytes.subarray(base + 4, base + 12); // 8 bytes
    next.selectorMap.set(sel, { authSlot, versionSlot, extCodeHash64: hash });
  }

  // stage into (xe).d 
  stageAccount(env, xsId, next);
  
  return finish(s1, OK);
};

