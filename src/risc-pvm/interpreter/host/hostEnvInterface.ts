import { AccEnv, AccumulateContext, FetchVector, ServiceAccount } from "./types";
import { cloneEntry, cloneMap, cloneSet, cloneU8, encodeInfoHelper, hydrateAccEnv } from "./helpers"
import { ExitReasonType, RunInnerMachineFn } from "../types";
import { MachineEntry } from "./innerMem/types";

// output option parameters
export interface HostEnvInterface {
  // seconds since JAM CE (4.4), 8 byte
  now(): bigint; // ΩG

  // Return byte‑blob for the requested ΩY fetch vector or null if absent.
  fetchVector(name: FetchVector): Uint8Array | null; // vLength in ΩY 

  machineTable: Map<number, MachineEntry>; // ΩM, table of inner-machines (Refine)... m of (m, e) 
  runInnerMachine?: RunInnerMachineFn;

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

  onPageFault?: (addr: number, len: number, code: number) => void;
  getStagedStorageWrites?: () => { key: Uint8Array; value: Uint8Array }[];
  getStagedStorageDeletes?: () => Uint8Array[];
  getAllStorageEntries?: () => { key: Uint8Array; value: Uint8Array }[];
  clearStaged?: () => void;

  ioBuffer?: Uint8Array;


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
  runInnerMachine?: RunInnerMachineFn;
  accounts?: Map<bigint, ServiceAccount>;
  activationFee?: bigint; // global existential deposit / minimum balance
  initAcc?: Partial<AccumulateContext>;

  ioBuffer?: Uint8Array;
  ioBufferSize?: number;
  
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
    runInnerMachine,
    accounts,
    activationFee = 0n,
    initAcc,
    
  } = opts;

  // Convert the vectors object into a Map for fast lookup
  const keyStr = (u8: Uint8Array) => Buffer.from(u8).toString("hex");
  const keyU8  = (hex: string) => new Uint8Array(Buffer.from(hex, "hex"));

  const map = new Map(Object.entries(vectors) as [FetchVector, Uint8Array][]);
  const store  = storage ?? new Map<string, Uint8Array>();
  const stagedWrites: { key: Uint8Array; value: Uint8Array }[] = [];
  const stagedDeletes: Uint8Array[] = [];
  const images  = preImage ?? new Map<string, Uint8Array>();
  const infos   = infoMap  ?? new Map<string, Uint8Array>();
  const mTable = machines ?? new Map<number, { p: Uint8Array; u: any; i: number }>();
  const svcTab  = accounts ?? new Map<bigint, ServiceAccount>();
  const initEnv = hydrateAccEnv(initAcc?.allocator?.env);

  const ioBuffer = new Uint8Array(0x20000); // 128 KiB, zeroed


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

    // accumulate staged writes
    stagedWrites.push({ key: k.slice(), value: v.slice() });

  };
  const del = (k: Uint8Array) => {
    const s = keyStr(k);
    const old = store.get(s);
    if (old) { used -= old.length; store.delete(s); }

    // accumulate staged deletes
    stagedDeletes.push(k.slice());

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

  if (process.env.JAM_DEBUG_HOST === "1" || process.env.JAM_DEBUG_ACC === "1") {
    console.log("[env] runInnerMachine override:", !!opts.runInnerMachine);
  }

  const runInnerMachineFinal =
  runInnerMachine ?? ((p, ic, gas, regs, u) => ({
    exit: ExitReasonType.Halt,
    nextIc: ic,
    gasRemaining: gas,
    regs,
    u
  }));


  
  return {
    now: () => now,

    fetchVector: (v) => map.get(v) ?? null,

    ioBuffer,

    //only used when provided
    getStorage : get,
    putStorage : put,
    deleteStorage : del,

    getStagedStorageWrites: () => stagedWrites.map(w => ({ key: w.key.slice(), value: w.value.slice() })),
    getStagedStorageDeletes: () => stagedDeletes.map(k => k.slice()),
    getAllStorageEntries: () =>
      Array.from(store.entries()).map(([hex, val]) => ({ key: keyU8(hex), value: val.slice() })),
    clearStaged: () => { stagedWrites.length = 0; stagedDeletes.length = 0; },

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
    runInnerMachine: runInnerMachineFinal,

    activationFee,

    acc,

    onPageFault: (addr, len, code) => {
      console.error(
        `[env/PageFault] addr=0x${addr.toString(16)} len=${len} code=${code}`
      );
    },

  
  };
}


  
