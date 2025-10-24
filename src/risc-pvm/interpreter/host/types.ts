import { InterpreterState } from "../types";
import { HostEnvInterface } from "./hostEnvInterface";

export type HostMode = "accumulate" | "refine" | "isAuth" | "general";

// Fetch‑vector identifiers for ΩY.
export type FetchVector =
  | "config" // c - configuration vector
  | "paramBlob" // n - parameters for the inner invocation
  | "returnBlob" // r - result blob from previous call
  | "imports" // i - array of blobs for imports
  | "programBlob" // p - the whole work-package blob
  | "workItems" // x - list of work item records
  | "authoriserTrace" // o - validator authorisation trace
  | "transferList"; // t - list of transfers

export enum FetchSel {
  Config = 0, // c
  Params = 1, // n
  Returns = 2, // r
  ImportsElem = 3, // x[w11][w12]
  ImportsList = 4, // x[i][w11]
  WorkItemsElem = 5, // i[w11][w12]
  WorkItemsList = 6, // i[i][w11]
  ProgSerialized = 7, // E(p)
  ProgMeta = 8, // E(pu, <pointer to>pp)
  ProgJ = 9, // pj
  ProgX = 10, // px
  ProgWords = 11, // E([...])
  ProgWordLen = 12, // S(pw[w11])
  ProgWordField = 13, // pw[w11]y

  AuthTraceSer = 14, // E(<pointer to>o)
  AuthTraceElem = 15, // E(o[w11])
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
  env: HostEnvInterface
) => InterpreterState;

export type Hex32 = string;

// (9.3) in spec
export interface ServiceAccount {
  storage: Map<string, Uint8Array>; // s
  preimages: Map<string, Uint8Array>; // p
  lookupStorage: Map<string, Uint8Array>; // (l) for historical flags
  rootCodeHash: bigint; // c
  balance: bigint; // b
  gasAccumulate: bigint; // g
  gasOnTransfer: bigint; // m
  cores: Uint8Array; // (q) Qx32 bytes
  selectorMap: Map<
    number,
    { authSlot: number; versionSlot: number; extCodeHash64: Uint8Array }
  >; // from bless // a: auth_id, v: version_id, g: code_hash
  designations?: Uint8Array; // v - designations for the service
  ticketNext?: bigint; // tt – running ticket number
  coresOffset?: number; // to – where cores live inside δ-blob (stub = 0)
  ticketIndex?: number; // ti – current queue head (stub = 0)

  threshold?: bigint; // (xs).t
  ledger?: Map<Hex32, Map<number, Uint8Array>>;
}

// export interface EncodableAccount extends ServiceAccount {
//     ticketNext: bigint;   // tt – running ticket number
//     coresOffset: number;  // to – where cores live inside δ-blob (stub = 0)
//     ticketIndex: number;  // ti – current queue head (stub = 0)
//   }

export type ServiceId = bigint; // NS
export type CoreIndex = number; // 0..C-1
export type CoreAssignmentVector = Uint8Array; // length = 32 * Q (spec)

export type DeferredTransfer = Array<{
  from: bigint; // s s ∈ N_S
  to: bigint; // d ∈ N_S
  amount: bigint; // a ∈ N_B
  gasLimit: bigint; // m ∈ B^WT
  memo: Uint8Array; // g ∈ N_G
}>; // transfers for the accumulator

// --- Designation entry fields for ΩJ (eject) ---
// di does not equal 2 from sepc.
export const DESIGNATION_ROLE_EJECT = 2 as const;

export interface EjectWitnessTuple {
  x: bigint; // producer id (or service id), spec: [x, y]
  y: bigint; // timestamp/check value
}

export type EjectWitnessKey = string;

// One designation entry (what the spec calls “d” with fields d_c, d_i, d_o, d_ℓ)
export interface DesignationEntry {
  boundCodeHash32: Uint8Array; // d_c — must equal E32(xs)
  role: number; // d_i — 2 for eject
  witnessBaseOffset: number; // d_o — used to compute l = max(81, d_o) - 81
  witnessIndex?: Map<EjectWitnessKey, EjectWitnessTuple>; // d_l: (h,l) -> [x,y]
}

export type DesignationMap = Map<number, ServiceId>;
export interface AccEnv {
  // xe
  deltas: Map<bigint, any>; // (xe.d) — mutable staging (service mutations this block)
  currentServiceId?: bigint; // (xe.m) – the payer / current service
  root?: bigint; // (xe.r) – root code-hash for the current service

  deleted?: Set<ServiceId>; // services deleted during this block

  assignServiceAccount?: Map<CoreIndex, ServiceId>; // (xe).a[c] — assigned owner service for core c
  assignCore?: Map<CoreIndex, CoreAssignmentVector>; // (xe).q[c] — the 32*Q bytes core c’s assignment vector

  designations?: DesignationMap; // (parsed) (xe).i — designations (ΩD)
  designationsRaw?: Uint8Array; // (raw version)
  designationEntries?: Map<ServiceId, DesignationEntry>;
}

export interface AccumulateX {
  index: bigint; // xi — allocator index (ring)
  env: AccEnv; // xe — environment for the accumulatorn (deltas and meta)
  transfers?: DeferredTransfer; // (xe).t — transfers for the accumulator

  providesSeen?: Map<bigint, Set<string>>; // track duplicates within block
  provides?: Array<{ s: bigint; i: Uint8Array }>; // x_p — list of (s,i) pairs provided during the block
}

export interface AccumulateY {
  checkpoint?: AccumulateX; // y' — checkpoint mirror (snapshot of x at last ΩC)
  yield?: Uint8Array; // yy — yield blob for ΩY
}

export interface AccumulateContext {
  allocator: AccumulateX; // x the mutable accumulation state for this service during the block.
  session: AccumulateY; // y
}

export interface ExecOpts {
  codeHash: Uint8Array;
  programBlob: Uint8Array;   // could have G manifest
  initialGas: bigint;
  memSize?: number;
  args?: Uint8Array;
  env?: HostEnvInterface;
  overrideHost?: HostDispatcher;
  preferCachedCode?: boolean; // default true
};