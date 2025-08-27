import { HostEnvInterface } from "../../hostEnvInterface";
import { ServiceAccount, ServiceId } from "../../types";

export function getOverlayChangeSet(env: HostEnvInterface, id: bigint): ServiceAccount | undefined {

  const xe = env.acc.allocator.env;
  if (!xe) return env.getService(id); 
  if (xe.deleted?.has(id)) return undefined;
  const staged = env.acc.allocator.env.deltas.get(id) as ServiceAccount | undefined;

  return staged ?? env.getService(id);
}

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