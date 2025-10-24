import { Gas } from "../../types";
import { InnerMachineState } from "./host/innerMem/types";
import { MapPlanEntry } from "./initializer/types";
import { InstructionAddressTypes } from "./instructions/opcodes";

export interface PageMeta { read: boolean; write: boolean; }
export type PageTable = PageMeta[];

interface InterpreterContext {
  jumpTable: number[];          // deconstructed jump from deblob
  jumpEntryLength: number;        // Size of each jump index in bytes
  jumpEntries?: number[]; // deconstructed jump entries
  basicBlockStarts: Set<number>; // Precomputed basic block starts
  heapStart: number;      // Initial heap start address for dynamic memeory allocation
  heapPointer: number;    // Current position of the heap pointer for dynamic memory allocation
  heapEnd: number;        // Upper bound of the heap
  pageTable: PageTable;   // Page table for memory access control

}
export type InterpreterState = {
  code: Uint8Array;            // Code to execute (ϲ), typically an ArrayBuffer-backed typed array
  opcodeMaskBits: boolean[];   // Opcode mask bits (ϳ), array of booleans indicating which opcodes are enabled
  pc: number;                  // Program counter (ı)
  gas: Gas;                 // Gas remaining (ϱ)
  registers: bigint[];         // General-purpose registers (φ), array of 13 registers as per spec
  memory: Uint8Array;          // RAM (μ), typically an ArrayBuffer-backed typed array
  exit?: ExitReason;     // reason why the interpreter stopped
  context?: InterpreterContext;
};

// Exit reasons
export enum ExitReasonType {
  Continue,  // ▸
  Halt,      // ∎
  Panic,     // ☇
  OutOfGas,  // ∞
  PageFault, // F
  HostCall,  // ḣ
}

export type ExitReason = {
  type: ExitReasonType;
  detail?: number | string;
  id?: bigint;
};

export type ExecutionHandler = (state: InterpreterState, operands: any[]) => InterpreterState;

export interface OpcodeDefinition {
  opcode: number;
  name: string;
  addressType: InstructionAddressTypes;
  gasCost: Gas;
  execute: ExecutionHandler;
}


// --- InnerRunResult
export type InnerRunResult = {
  exit: ExitReasonType;          // ε
  nextIc: number;                // ı'
  gasRemaining: Gas;          // ϱ'
  regs: BigUint64Array;          // φ' (length 13)
  u: InnerMachineState;          // μ' memory (engine-defined)
  hostId?: bigint;               // h
  faultPage?: bigint;            // x
};

export type RunInnerMachineFn = (
  p: Uint8Array, // blob
  ic: number, // instruction counrer
  gas: Gas, // gas
  regs: BigUint64Array, // registers
  u: InnerMachineState // (u') memory
) => InnerRunResult;

export interface BaseInitResult {
  code: Uint8Array;       // (p) inner program blob
  registers: bigint[];
  memInit: Uint8Array;    // initial memory image
  heapStart: number;
  heapEnd: number;
  mapPlan?: MapPlanEntry[]; // optional for raw mode
}
