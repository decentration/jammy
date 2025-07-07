import { InstructionAddressTypes } from "./instructions/opcodes";


export const PAGE_SIZE = 0x10000; // 64 KiB

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
  gas: number;                 // Gas remaining (ϱ)
  registers: bigint[];         // General-purpose registers (ω), array of 13 registers as per spec
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
  gasCost: number;
  execute: ExecutionHandler;
}


