import { HostEnvInterface } from "../../hostEnvInterface";
import { ServiceAccount, ServiceId } from "../../types";

export function getOverlayChangeSet(env: HostEnvInterface, id: bigint): ServiceAccount | undefined {

  const xe = env.acc.allocator.env;
  if (xe.deleted?.has(id)) return undefined;
  const staged = env.acc.allocator.env.deltas.get(id) as ServiceAccount | undefined;
  if (xe.deleted?.has(id)) return undefined;

  return staged ?? env.getService(id);
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