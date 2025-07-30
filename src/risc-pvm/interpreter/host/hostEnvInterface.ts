import { FetchVector, MachineEntry } from "./types";

// output option parameters
export interface HostEnvInterface {
  // seconds since JAM CE (4.4), 8 byte
  now(): bigint; // ΩG

  // Return byte‑blob for the requested ΩY fetch vector or null if absent.
  fetchVector(name: FetchVector): Uint8Array | null; // Sv in ΩY 

  machineTable: Map<number, MachineEntry>; // ΩM, table of inner-machines (Refine)

  getStorage?: (key: Uint8Array) => Uint8Array | undefined;  // as[k] / ss[k] in ΩR and ΩW 
  putStorage?: (key: Uint8Array, value: Uint8Array) => void; // mutate ΩW
  deleteStorage?: (key: Uint8Array) => void; // delete ΩW
  lookupPreimage?:  (hash: Uint8Array) => Uint8Array | undefined;  // ΩL provides ap[...] value
  getInfo?:        (id: bigint) => any; // t in ΩI
  encodeInfo?:     (info: any) => Uint8Array; // m in ΩI
  hasService?: (id: bigint) => boolean; // used by various
  isFull? (): boolean; //  ΩW and ΩE to retrun FULL

  historicalLookup?: (hash: Uint8Array) => Uint8Array | undefined; // ΩH
  exportOffset?: number;  // ΩE offset to export data
  exportSegments?: Uint8Array[]; // ΩE mutable array that gathers x segments to export
}

// input option parameters
export interface HostEnvOptions {
  vectors?: Partial<Record<FetchVector, Uint8Array>>;
  now?: bigint;
  storage?: Map<string, Uint8Array>;
  capBytes?: number;
  preImage?: Map<string, Uint8Array>;
  infoMap?: Map<string, Uint8Array>;
  expOff?: number;
  expSegs?: Uint8Array[];
  machines?: Map<number, { p: Uint8Array; u: any; i: number }>;

}

export function makeHostEnv(opts: HostEnvOptions = {}): HostEnvInterface {
  const {
    vectors = {},
    now = 0n,
    storage,
    capBytes = Infinity,
    preImage,
    infoMap,
    expOff,
    expSegs,
    machines
  } = opts;

  // Convert the vectors object into a Map for fast lookup
  const map = new Map(Object.entries(vectors) as [FetchVector, Uint8Array][]);
  const store  = storage ?? new Map<string, Uint8Array>();
  const images  = preImage ?? new Map<string, Uint8Array>();
  const infos   = infoMap  ?? new Map<string, Uint8Array>();
  const keyStr = (u8: Uint8Array) => Array.from(u8).join(",");

  let used = 0;
  store.forEach(v => { used += v.length; });

  // get, put, del functions for storage
  const get  = (k: Uint8Array) => store.get(keyStr(k));
  const put  = (k: Uint8Array, v: Uint8Array) => {
    const s = keyStr(k);
    const old = store.get(s);
    if (old) used -= old.length;
    used += v.length;
    store.set(s, v);
  };
  const del = (k: Uint8Array) => {
    const s = keyStr(k);
    const old = store.get(s);
    if (old) { used -= old.length; store.delete(s); }
  };


  // !TODO update function with multi service support.
  const hasService = (id: bigint) => id === (2n ** 64n - 1n);  

  const mTable = machines ?? new Map<number, { p: Uint8Array; u: any; i: number }>();

  return {
    now: () => now,

    fetchVector: (v) => map.get(v) ?? null,

    //only used when provided
    getStorage : get,
    putStorage : put,
    deleteStorage : del,
    lookupPreimage: h => images.get(keyStr(h)), 
    historicalLookup: h => images.get(keyStr(h)), // refine
    getInfo: id => infos.get(id.toString()),
    encodeInfo: i => i,
  

    isFull     : () => used > capBytes,
    hasService,

    exportOffset : expOff,
    exportSegments: expSegs ?? [],
    machineTable: mTable,

  };
}


  
