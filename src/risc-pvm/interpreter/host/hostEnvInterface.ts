import { FetchVector } from "./types";

export interface HostEnvInterface {
  // seconds since JAM CE (4.4), 8 byte
  now(): bigint;

  // Return byte‑blob for the requested ΩY fetch vector or null if absent.
  fetchVector(name: FetchVector): Uint8Array | null;
}
  
export function makeHostEnv(
  vectors: Partial<Record<FetchVector, Uint8Array>> = {},
  now: bigint = 0n
): HostEnvInterface {

  // Convert the vectors object into a Map for fast lookup
  const map = new Map(Object.entries(vectors) as [FetchVector, Uint8Array][]);
  
  return {
    now: () => now,
    
    fetchVector: (v) => map.get(v) ?? null,
  };
}
  
