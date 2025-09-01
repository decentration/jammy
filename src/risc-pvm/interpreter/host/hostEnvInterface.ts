import { AccEnv, AccumulateContext, DesignationEntry, FetchVector, MachineEntry, ServiceAccount, ServiceId } from "./types";
import { cloneEntry, cloneMap, cloneSet, cloneU8, encodeInfoHelper } from "./helpers"

// output option parameters
export interface HostEnvInterface {
  // seconds since JAM CE (4.4), 8 byte
  now(): bigint; // ΩG

  // Return byte‑blob for the requested ΩY fetch vector or null if absent.
  fetchVector(name: FetchVector): Uint8Array | null; // vLength in ΩY 

  machineTable: Map<number, MachineEntry>; // ΩM, table of inner-machines (Refine)... m of (m, e) 

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
  exportSegments?: Uint8Array[]; // ΩE mutable array that gathers x segments to export e of (m, e)

  getService: (id: bigint) => ServiceAccount | undefined;
  putService: (id: bigint, ac: ServiceAccount) => void;

  acc: AccumulateContext; // (x,y)

  activationFee?: bigint; // global existential deposit / minimum balance
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
  accounts?: Map<bigint, ServiceAccount>;
  activationFee?: bigint; // global existential deposit / minimum balance
  initAcc?: Partial<AccumulateContext>;
  
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
    machines,
    accounts,
    activationFee = 0n,
    initAcc,
    
  } = opts;

  // Convert the vectors object into a Map for fast lookup
  
  const keyStr = (u8: Uint8Array) => Buffer.from(u8).toString("hex");
  const map = new Map(Object.entries(vectors) as [FetchVector, Uint8Array][]);
  const store  = storage ?? new Map<string, Uint8Array>();
  const images  = preImage ?? new Map<string, Uint8Array>();
  const infos   = infoMap  ?? new Map<string, Uint8Array>();
  const mTable = machines ?? new Map<number, { p: Uint8Array; u: any; i: number }>();

  const svcTab  = accounts ?? new Map<bigint, ServiceAccount>();
  const initEnv = initAcc?.allocator?.env;

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


  const getService = (id: bigint) => svcTab.get(id);
  const putService = (id: bigint, acct: ServiceAccount) => svcTab.set(id, acct);
  const hasService = (id: bigint) => svcTab.has(id);

  const xe: AccEnv = {
    deltas: cloneMap(initEnv?.deltas),
    currentServiceId: initEnv?.currentServiceId,
    root: initEnv?.root ?? 0n,
    deleted: cloneSet(initEnv?.deleted),
    designations: cloneMap(initEnv?.designations),
    designationsRaw: cloneU8(initEnv?.designationsRaw),
    assignServiceAccount: cloneMap(initEnv?.assignServiceAccount),
    assignCore: new Map(
      [...(initEnv?.assignCore ?? new Map<number, Uint8Array>())]
        .map(([idx, vec]) => [idx, vec.slice()]) // deep copy each Uint8Array
    ),    
    designationEntries: new Map([...(initEnv?.designationEntries ?? new Map())]
      .map(([svcId, entry]) => [svcId, cloneEntry(entry)]))
  };
  
  const acc: AccumulateContext = { // acc(umulator) context
    allocator: {
      index: initAcc?.allocator?.index ?? 0n,
      env: xe,
      transfers: (initAcc?.allocator?.transfers ?? []).map(t => ({
        from: t.from, to: t.to, amount: t.amount, gasLimit: t.gasLimit, memo: t.memo.slice()
      })),         
      providesSeen: new Map(
        [...(initAcc?.allocator?.providesSeen ?? new Map<bigint, Set<string>>())]
          .map(([sid, set]) => [sid, new Set(set)])
      ),
      provides: (initAcc?.allocator?.provides ?? []).map(p => ({ s: p.s, i: p.i.slice() })),
    },
    session: { 
      yield: initAcc?.session?.yield,
      checkpoint: initAcc?.session?.checkpoint,
    }
  };

  
  return {
    now: () => now,

    fetchVector: (v) => map.get(v) ?? null,

    //only used when provided
    getStorage : get,
    putStorage : put,
    deleteStorage : del,
    lookupPreimage: h => images.get(keyStr(h)), 
    historicalLookup: h => images.get(keyStr(h)), // refine
    getInfo     : (id: bigint) => svcTab.get(id),
    encodeInfo: encodeInfoHelper,
  

    isFull     : () => used > capBytes,

    getService, 
    putService,
    hasService,

    exportOffset : expOff,
    exportSegments: expSegs ?? [],
    machineTable: mTable,

    activationFee,

    acc,
  
  };
}


  
