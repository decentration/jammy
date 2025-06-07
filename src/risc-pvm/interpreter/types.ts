import { InstructionAddressTypes } from "./instructions/opcodes";

export type InterpreterState = {
  code: Uint8Array;            // Code to execute (ϲ), typically an ArrayBuffer-backed typed array
  opcodeMaskBits: boolean[];   // Opcode mask bits (ϳ), array of booleans indicating which opcodes are enabled
  pc: number;                  // Program counter (ı)
  gas: number;                 // Gas remaining (ϱ)
  registers: bigint[];         // General-purpose registers (ω), array of 13 registers as per spec
  memory: Uint8Array;          // RAM (μ), typically an ArrayBuffer-backed typed array
  exit?: ExitReason;     // reason why the interpreter stopped

};

// Exit reasons
export enum ExitReasonType {
  Continue,  // ▸
  Halt,      // ∎
  Panic,     // ☇
  OutOfGas,  // ∞
  PageFault, // F
  HostCall,  // ḣ
  Running // c 
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


