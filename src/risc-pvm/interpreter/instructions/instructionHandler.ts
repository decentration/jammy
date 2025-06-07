import { skip } from "../utils/skip";
import { ExecutionHandler, ExitReasonType, InterpreterState } from "../types";
import { Opcodes } from "./opcodes";

function nextPc(state: InterpreterState): number {
  const opBytes = skip(state.pc, state.opcodeMaskBits);
  return state.pc + 1 + opBytes;
}

const GAS_PER_INSTRUCTION   = 1;   // for M1
const GAS_HOST_CALL         = 10;  // Host call premium

export const trapHandler: ExecutionHandler = (s) => ({
  ...s,
  gas  : s.gas - GAS_PER_INSTRUCTION,
  exit : { type: ExitReasonType.Panic },
});

export const fallthroughHandler: ExecutionHandler = (s) => ({
  ...s,
  pc   : s.pc + 1, // 1 byte instruction
  gas  : s.gas - GAS_PER_INSTRUCTION,
  exit : undefined, // continue execution
});
  
export const ecalliHandler: ExecutionHandler = (s, [imm]) => ({
  ...s,
  pc   : nextPc(s),
  gas  : s.gas - GAS_HOST_CALL, // decrement gas by host-call rate
  exit : { type: ExitReasonType.HostCall, id: BigInt(imm) },  // immediate passed
});

export const loadImm64Handler: ExecutionHandler = (state, [rA, imm]) => {
  const registers = state.registers.slice();
  registers[rA] = imm as bigint;
  return {
    ...state,
    registers,
    pc: state.pc + GAS_HOST_CALL,
    gas: state.gas - GAS_PER_INSTRUCTION,
    exit: undefined
  };
};
  
export const instructionHandlers: Record<number, ExecutionHandler> = {
  [Opcodes.trap]: trapHandler,
  [Opcodes.ecalli]: ecalliHandler,
  [Opcodes.fallthrough]: fallthroughHandler,
  [Opcodes.load_imm_64]: loadImm64Handler,
};
