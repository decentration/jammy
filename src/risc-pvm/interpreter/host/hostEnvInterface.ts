import { FetchVector } from "./types";

export interface HostEnvInterface {
  // seconds since JAM CE (4.4), 8 byte
  now(): bigint;

  // Return byte‑blob for the requested ΩY fetch vector or null if absent.
  fetchVector(name: FetchVector): Uint8Array | null;

  getStorage?: (key: Uint8Array) => Uint8Array | undefined; 
  putStorage?: (key: Uint8Array, value: Uint8Array) => void;

}
  
export function makeHostEnv(
  vectors: Partial<Record<FetchVector, Uint8Array>> = {},
  now: bigint = 0n,
  storage?: Map<string, Uint8Array>,
): HostEnvInterface {

  // Convert the vectors object into a Map for fast lookup
  const map = new Map(Object.entries(vectors) as [FetchVector, Uint8Array][]);
  const store  = storage ?? new Map<string, Uint8Array>();
  const keyToStr = (u8: Uint8Array) => Array.from(u8).join(",");

  return {
    now: () => now,

    fetchVector: (v) => map.get(v) ?? null,

    //only used when provided
    getStorage: key => store.get(keyToStr(key)), 
    putStorage: (key, val) => store.set(keyToStr(key), val), 
  };
}


  
