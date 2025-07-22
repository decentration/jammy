import { InterpreterState } from "../types";
import { HostEnvInterface } from "./hostEnvInterface";

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