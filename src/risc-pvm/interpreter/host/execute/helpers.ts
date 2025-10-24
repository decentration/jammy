import { toHexPlain } from "../../../../utils";

export function preferCache(
  codeHash: Uint8Array,
  freshCode: Uint8Array,
  preferCached = true
): Uint8Array {
  if (!preferCached) return freshCode;
  const key = toHexPlain(codeHash);
  const cached = innerCodeCache.get(key);
  if (cached) return cached;
  innerCodeCache.set(key, freshCode);
  return freshCode;
}

export const innerCodeCache = new Map<string, Uint8Array>();

export function invalidatePrepared(codeHash: Uint8Array) {
  innerCodeCache.delete(toHexPlain(codeHash));
}
