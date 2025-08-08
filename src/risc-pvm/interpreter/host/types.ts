import { InterpreterState } from "../types";
import { HostEnvInterface } from "./hostEnvInterface";

export type MachineEntry = { p: Uint8Array; u: any; i: number };


// Fetch‑vector identifiers for ΩY.
export type FetchVector =
    | "codeBlob"        // c - compiled code of the inner program
    | "paramBlob"       // n - parameters for the inner invocation
    | "returnBlob"      // r - result blob from previous call 
    | "imports"         // i - array of blobs for imports
    | "programBlob"     // p - the whole work-package blob
    | "workItems"       // x - list of work item records
    | "authoriserTrace" // o - validator authorisation trace 
    | "transferList";   // t - list of transfers

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
  