import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { SVC_ID, OK, PAYLOAD_BYTES } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";


// ΩD – designate (selector 7)
export const designateHandler: HostCallHandler = (s, _id, env) => {
  const srcPtr = Number(s.registers[7]); // (o)

  const { bytes, state: s1 } = readBytes(s, srcPtr, PAYLOAD_BYTES);
  if (!bytes)
    return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  // fetch or create the service account
  const service: ServiceAccount = env.getService(SVC_ID) ?? {
    storage       : new Map(),
    preimages     : new Map(),
    lookupStorage : new Map(),
    rootCodeHash  : 0n,
    balance       : 0n,
    gasAccumulate : 0n,
    gasOnTransfer : 0n,
    cores         : new Uint8Array(32 * 8),
    selectorMap   : new Map(),
  };

  service.designations = bytes.slice(); // store “v”
  env.putService(SVC_ID, service);

  return finish(s1, OK);
};