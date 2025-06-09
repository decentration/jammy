import { skip } from "../utils/skip";
import { ExecutionHandler, ExitReasonType, InterpreterState } from "../types";
import { Opcodes } from "./opcodes";
import { branch } from "../utils/branch";
import { computeBasicBlockStarts } from "../computeBasicBlockStarts";
import { GAS_PER_INSTRUCTION, GAS_HOST_CALL, GAS_COST_JUMP } from "../consts";

function nextPc(state: InterpreterState): number {
  const opBytes = skip(state.pc, state.opcodeMaskBits);
  return state.pc + 1 + opBytes;
}

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

export const loadImm64Handler: ExecutionHandler = (s, [rA, imm]) => {
  const registers = s.registers.slice();
  registers[rA] = imm as bigint;
  return {
    ...s,
    registers,
    pc: s.pc + GAS_HOST_CALL,
    gas: s.gas - GAS_PER_INSTRUCTION,
    exit: undefined
  };
};

export const storeImmU8Handler: ExecutionHandler = (s, [address, value]) => {
  const memory = s.memory.slice();
  
  if (address >= memory.length) {
    return { ...s, exit: { type: ExitReasonType.Panic } };
  }

  memory[Number(address)] = Number(value & 0xffn); // store only 8 bits

  return {
    ...s,
    memory,
    pc: nextPc(s), 
    gas: s.gas - GAS_PER_INSTRUCTION,
    exit: undefined
  };
};

export const storeImmU16Handler: ExecutionHandler = (s, [address, value]) => {
  const memory = s.memory.slice();
  
  if (address >= memory.length) {
    return { ...s, exit: { type: ExitReasonType.Panic } };
  }
  // store 16 bits
  const lower16 = Number(value & 0xffffn); // take 1111 1111 1111 1111
  // put in memory in LE 
  memory[Number(address)] = lower16 & 0xff; // lower byte
  memory[Number(address) + 1] = (lower16 >> 8) & 0xff; // upper byte

  return {
    ...s,
    memory,
    pc: nextPc(s), 
    gas: s.gas - GAS_PER_INSTRUCTION,
    exit: undefined
  };
};

// store_imm_u32Handler
const storeImmU32Handler: ExecutionHandler = (s, [address, value]) => {
  const memory = s.memory.slice();
  if (address >= memory.length) {
    return { ...s, exit: { type: ExitReasonType.Panic } };
  }
  // store 32 bits
  const bits32 = Number(value & 0xffffffffn); // take 1111 1111 1111 1111 1111 1111 1111 1111
  // put in memory in LE  
  memory[Number(address)] = bits32 & 0xff; // lower byte
  memory[Number(address) + 1] = (bits32 >> 8) & 0xff; // second byte
  memory[Number(address) + 2] = (bits32 >> 16) & 0xff; // third byte
  memory[Number(address) + 3] = (bits32 >> 24) & 0xff; // upper byte

  return {
    ...s,
    memory,
    pc: nextPc(s),
    gas: s.gas - GAS_PER_INSTRUCTION,
    exit: undefined
  };
}

const storeImmU64Handler: ExecutionHandler = (s, [address, value]) => {
  const memory = s.memory.slice();
  if (address >= memory.length) {
    return { ...s, exit: { type: ExitReasonType.Panic } };
  }
  // store 64 bits
  const bits64 = BigInt(value & 0xffffffffffffffffn); // take 64 bits
  // put in memory in LE
  memory[Number(address)] = Number(bits64 & 0xffn); // lower byte
  memory[Number(address) + 1] = Number((bits64 >> 8n) & 0xffn); // second byte
  memory[Number(address) + 2] = Number((bits64 >> 16n) & 0xffn); // third byte
  memory[Number(address) + 3] = Number((bits64 >> 24n) & 0xffn); // fourth byte
  memory[Number(address) + 4] = Number((bits64 >> 32n) & 0xffn); // fifth byte
  memory[Number(address) + 5] = Number((bits64 >> 40n) & 0xffn); // sixth byte
  memory[Number(address) + 6] = Number((bits64 >> 48n) & 0xffn); // seventh byte
  memory[Number(address) + 7] = Number((bits64 >> 56n) & 0xffn); // upper byte
  
  return {
    ...s,
    memory,
    pc: nextPc(s),
    gas: s.gas - GAS_PER_INSTRUCTION,
    exit: undefined
  };
};

const jumpHandler: ExecutionHandler = (s: InterpreterState, operands: (number | bigint)[]) => {
  const [offset] = operands;  
  const basicBlockStarts = computeBasicBlockStarts(s.code, s.opcodeMaskBits);
  const targetPc = s.pc + Number(offset);
  const { exitReason, pc } = branch(targetPc, true, basicBlockStarts, s.pc);
console.log("Jumping to target PC:", { targetPc, exitReason, pc });
  return {
    ...s,
    pc,
    gas: s.gas - GAS_COST_JUMP,
    exit: { type: exitReason },

  };
};


export const instructionHandlers: Record<number, ExecutionHandler> = {
  [Opcodes.trap]: trapHandler,
  [Opcodes.ecalli]: ecalliHandler,
  [Opcodes.fallthrough]: fallthroughHandler,
  [Opcodes.load_imm_64]: loadImm64Handler,
  [Opcodes.store_imm_u8]: storeImmU8Handler,
  [Opcodes.store_imm_u16]: storeImmU16Handler,
  [Opcodes.store_imm_u32]: storeImmU32Handler,
  [Opcodes.store_imm_u64]: storeImmU64Handler,
  [Opcodes.jump]: jumpHandler,
};
