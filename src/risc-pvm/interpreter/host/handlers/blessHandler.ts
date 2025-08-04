import { readBytes, toLE } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { WHO, OK, SVC_ID, BYTES_PER_BLESS_HASH, MAX_BLESS_SELECTOR_SLOTS } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";

// ΩB – bless  (selector 5)
// bless handler is used to register a service with a set of selector-hash pairs.
export const blessHandler: HostCallHandler = (state, _id, env) => {
  const selectorSlot = Number(state.registers[7]); // (m) index into the service method slot
  const authSlot = Number(state.registers[8]);     // (a) index into the service authorisation slot
  const versionSlot = Number(state.registers[9]);  // (v) index into the service version slot 
  const off = Number(state.registers[10]);          //  (o) memory offset where the list of service hash pairs starts
  const len = Number(state.registers[11]);          // (n) the count of how many 12-byte pairs to read

  if (selectorSlot >= MAX_BLESS_SELECTOR_SLOTS || authSlot >= MAX_BLESS_SELECTOR_SLOTS || versionSlot >= MAX_BLESS_SELECTOR_SLOTS) return finish(state, WHO);

  // check if we have enough bytes to read. 
  // 12 bytes per bless hash, so 8 bytes for the hash and 4 bytes for the selector.
  // lets change the name "need" to 
  const need = BYTES_PER_BLESS_HASH * len;

  const { bytes, state: s1 } = readBytes(state, off, need); // g, derive
  if (!bytes) return { state:{ ...state, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // service is getService or create new service with default values
  const service: ServiceAccount =  env.getService(SVC_ID) ?? {
    storage        : new Map(), // key-value storage
    preimages      : new Map(), // preimages for hashes
    lookupStorage  : new Map(), 
    rootCodeHash       : 0n, // 
    balance        : 0n,
    gasAccumulate  : 0n,
    gasOnTransfer  : 0n,
    cores          : new Uint8Array(32 * 8),      // Q = 8 cores stub !TODO
    selectorMap    : new Map(),
  };

  for (let i = 0; i < len; i++) {
    const off = i * BYTES_PER_BLESS_HASH;

    const sel = bytes[off] | (bytes[off+1]<<8) | (bytes[off+2]<<16) | (bytes[off+3]<<24);  // D4 - 32-bit LE
    const hash = bytes.subarray(off+4, off+12);  // E8 = 64-bit

    service.selectorMap.set(Number(sel), { authSlot, versionSlot, extCodeHash64: hash });
  }

  env.putService(SVC_ID, service); // stash g here for later down the pipeline. 

  return finish(s1, OK);
};

