import { HostEnvInterface } from "../../hostEnvInterface";
import { ServiceAccount, ServiceId } from "../../types";

// return the effective merged view of xs in Accumulate.
// If there is a staged delta for xs, return that; else fall back to committed
export function getMergedXs(env: HostEnvInterface): ServiceAccount | undefined {
  const xe = env.acc?.allocator?.env;
  const xsId = xe?.currentServiceId;
  if (xsId === undefined) return undefined;
  if (xe?.deleted?.has(xsId)) return undefined;

  const staged = xe?.deltas?.get(xsId) as ServiceAccount | undefined;
  return staged ?? env.getService(xsId);
}

// return only the staged view for a given id (non-xs) in Accumulate.
// No fallback to committed state. 
export function getStagedOnly(env: HostEnvInterface, id: ServiceId): ServiceAccount | undefined {
  const xe = env.acc?.allocator?.env;
  if (!xe) return undefined;
  if (xe.deleted?.has(id)) return undefined;
  return xe.deltas.get(id) as ServiceAccount | undefined;
}
  
// stage a mutated account into (xe).d
export function stageAccount(env: HostEnvInterface, id: bigint, acct: ServiceAccount): void {
  const xe = env.acc.allocator.env;
  xe.deleted?.delete(id);
  env.acc.allocator.env.deltas.set(id, acct);
}

export function stageTombstone(env: HostEnvInterface, id: ServiceId): void {
  const xe = env.acc.allocator.env;
  xe.deleted ??= new Set<ServiceId>();
  xe.deleted.add(id);
  xe.deltas.delete(id);
}


export function serviceExistsInAccumulate(env: HostEnvInterface, id: bigint): boolean {
  const xe = env.acc.allocator.env;
  if (xe.deleted?.has(id)) return false;
  return xe.deltas.has(id) || (env.hasService?.(id) ?? false);
}


// // previously used and is just like getStagedOnly but with fallback to committed
// export function getOverlayChangeSet(env: HostEnvInterface, id: bigint): ServiceAccount | undefined {

//   const xe = env.acc.allocator.env;
//   if (!xe) return env.getService(id); 
//   if (xe.deleted?.has(id)) return undefined;
//   const staged = env.acc.allocator.env.deltas.get(id) as ServiceAccount | undefined;

//   return staged ?? env.getService(id);
// }

export function ledgerGet(
  acct: ServiceAccount | undefined,
  hHex: string,
  idx: number
): Uint8Array | undefined {
  return acct?.ledger?.get(hHex)?.get(idx);
}

export function ledgerPut(
  acct: ServiceAccount,
  hHex: string,
  idx: number,
  value: Uint8Array
) {
  acct.ledger ??= new Map();
  let inner = acct.ledger.get(hHex);
  if (!inner) {
    inner = new Map();
    acct.ledger.set(hHex, inner);
  }
  inner.set(idx, value);
}
