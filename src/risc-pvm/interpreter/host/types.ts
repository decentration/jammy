import { InterpreterState } from "../types";
import { HostEnvInterface } from "./hostEnvInterface";

export type MachineEntry = { p: Uint8Array; u: any; i: number };


// Fetch‑vector identifiers for ΩY.
export type FetchVector =
    | "config"          // c - configuration vector
    | "paramBlob"       // n - parameters for the inner invocation
    | "returnBlob"      // r - result blob from previous call 
    | "imports"         // i - array of blobs for imports
    | "programBlob"     // p - the whole work-package blob
    | "workItems"       // x - list of work item records
    | "authoriserTrace" // o - validator authorisation trace 
    | "transferList";   // t - list of transfers

export enum FetchSel {
  Config = 0,          // c
  Params = 1,          // n
  Returns = 2,         // r
  ImportsElem = 3,     // x[w11][w12]
  ImportsList = 4,     // x[i][w11]
  WorkItemsElem = 5,   // i[w11][w12]
  WorkItemsList = 6,   // i[i][w11]
  ProgSerialized = 7,  // E(p)
  ProgMeta = 8,        // E(pu, <pointer to>pp)
  ProgJ = 9,           // pj
  ProgX = 10,          // px
  ProgWords = 11,      // E([...])
  ProgWordLen = 12,    // S(pw[w11])
  ProgWordField = 13,  // pw[w11]y

  AuthTraceSer = 14,   // E(<pointer to>o)
  AuthTraceElem = 15,  // E(o[w11])
  // TransfersSer = 16,   // E(<pointer to>t)
  // TransfersElem = 17,  // E(t[w11])
}

export const fetchVecSelectorMap: Record<number, FetchVector | undefined> = {
    // [FetchSel.Config] : "config",        // c

  [FetchSel.Params]: "paramBlob",
  [FetchSel.Returns]: "returnBlob",

  [FetchSel.ImportsElem]: "imports",
  [FetchSel.ImportsList]: "workItems",
  [FetchSel.WorkItemsElem]: "imports",
  [FetchSel.WorkItemsList]: "imports",

  [FetchSel.ProgSerialized]: "programBlob",
  [FetchSel.ProgMeta]: "paramBlob",
  [FetchSel.ProgJ]: "paramBlob",
  [FetchSel.ProgX]: "paramBlob",
  [FetchSel.ProgWords]: "paramBlob",
  [FetchSel.ProgWordLen]: "paramBlob",
  [FetchSel.ProgWordField]: "paramBlob",

  [FetchSel.AuthTraceSer]: "authoriserTrace",
  [FetchSel.AuthTraceElem]: "authoriserTrace",

  // [FetchSel.TransfersSer]: "transferList",
  // [FetchSel.TransfersElem]: "transferList",
};

// Host environment interface for the interpreter.
export type HostCallHandler = (
    state: InterpreterState,
    id: bigint,
    env: HostEnvInterface
) => { state: InterpreterState; ok: boolean };


export type HostDispatcher = (
    state: InterpreterState,
    env:   HostEnvInterface
) => InterpreterState;

// (9.3) in spec
export interface ServiceAccount {
    storage: Map<string, Uint8Array>; // s
    preimages: Map<string, Uint8Array>; // p
    lookupStorage: Map<string, Uint8Array>;   // (l) for historical flags
    rootCodeHash: bigint; // c
    balance: bigint; // b
    gasAccumulate: bigint;  // g
    gasOnTransfer: bigint; // m
    cores: Uint8Array; // (q) Qx32 bytes
    selectorMap  : Map<number, { authSlot:number; versionSlot:number; extCodeHash64:Uint8Array }>; // from bless // a: auth_id, v: version_id, g: code_hash
    designations?: Uint8Array; // v - designations for the service
    ticketNext?: bigint;   // tt – running ticket number
    coresOffset?: number;  // to – where cores live inside δ-blob (stub = 0)
    ticketIndex?: number;  // ti – current queue head (stub = 0)
}

// export interface EncodableAccount extends ServiceAccount {
//     ticketNext: bigint;   // tt – running ticket number
//     coresOffset: number;  // to – where cores live inside δ-blob (stub = 0)
//     ticketIndex: number;  // ti – current queue head (stub = 0)
//   }

// the difference between Record and Map is 
export interface AccEnv {           // xe
  deltas: Map<bigint, any>; // (xe.d) — mutable staging (service mutations this block)
  currentServiceId?: bigint;  // (xe.m) – the payer / current service
  root?: bigint; // (xe.r) – root code-hash for the current service
}

export interface AccumulateX {
  index: bigint;        // xi — allocator index (ring)
  env: AccEnv;          // xe — environment for the accumulatorn (deltas and meta)
}
  
export interface AccumulateY {
  scratch?: Record<string, any>; // ys — checkpoint mirror (snapshot of x at last ΩC)
}
  
export interface AccumulateContext {
  allocator: AccumulateX; // x the mutable accumulation state for this service during the block.
  session: AccumulateY; // y
}
