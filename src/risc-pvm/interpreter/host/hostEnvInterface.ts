import { FetchVector } from "./types";

export interface HostEnvInterface {
  // seconds since JAM CE (4.4), 8 byte
  now(): bigint;

  // Return byte‑blob for the requested ΩY fetch vector or null if absent.
  fetchVector(name: FetchVector): Uint8Array | null;

  getStorage?: (key: Uint8Array) => Uint8Array | undefined; 
  putStorage?: (key: Uint8Array, value: Uint8Array) => void;
  deleteStorage?: (key: Uint8Array) => void;

  hasService?: (id: bigint) => boolean;
  isFull? (): boolean;
}
  
export function makeHostEnv(
  vectors: Partial<Record<FetchVector, Uint8Array>> = {},
  now: bigint = 0n,
  storage?: Map<string, Uint8Array>,
  capBytes: number = Infinity,
): HostEnvInterface {

  // Convert the vectors object into a Map for fast lookup
  const map = new Map(Object.entries(vectors) as [FetchVector, Uint8Array][]);
  const store  = storage ?? new Map<string, Uint8Array>();
  const keyToStr = (u8: Uint8Array) => Array.from(u8).join(",");


  let used = 0;
  store.forEach(v => { used += v.length; });

  // get, put, del functions for storage

  const get  = (k: Uint8Array) => store.get(keyToStr(k));

  const put  = (k: Uint8Array, v: Uint8Array) => {
    const s = keyToStr(k);
    const old = store.get(s);
    if (old) used -= old.length;
    used += v.length;
    store.set(s, v);
  };
  const del = (k: Uint8Array) => {
    const s = keyToStr(k);
    const old = store.get(s);
    if (old) { used -= old.length; store.delete(s); }
  };


  // !TODO update function with multi service support.
  const hasService = (id: bigint) => id === (2n ** 64n - 1n);   

  return {
    now: () => now,

    fetchVector: (v) => map.get(v) ?? null,

    //only used when provided
    getStorage : get,
    putStorage : put,
    deleteStorage : del,
    isFull     : () => used > capBytes,

    hasService
  };
}


  
