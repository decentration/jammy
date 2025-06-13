import { skip } from "../utils/skip";
import { ExecutionHandler, ExitReasonType, InterpreterState } from "../types";
import { Opcodes } from "./opcodes";
import { branch } from "../utils/branch";
import { GAS_PER_INSTRUCTION, GAS_HOST_CALL, GAS_COST_JUMP, GAS_COST_JUMP_IND } from "../consts";
import { djump } from "../utils/djump";

function nextPc(state: InterpreterState): number {
  const opBytes = skip(state.pc, state.opcodeMaskBits);
  return state.pc + 1 + opBytes;
}

function panic(state: InterpreterState) {
  return { ...state, exit: { type: ExitReasonType.Panic } };
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
  
  if (address >= memory.length)  return panic(s);

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
  
  if (address >= memory.length) return panic(s);

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
  if (address >= memory.length) return panic(s);
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
  if (address >= memory.length) return panic(s);
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
  const basicBlockStarts = s.context?.basicBlockStarts;

  if (!basicBlockStarts) {
    return { ...s, exit: { type: ExitReasonType.Panic } };
  }
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

const jumpIndHandler: ExecutionHandler = (s: InterpreterState, operands: (number | bigint)[]) => {
  const [rA, immOffset] = operands; // operands[0]=register index, operands[1]=immediate offset
  const registerValue = Number(s.registers[Number(rA)]);
  const address = (registerValue + Number(immOffset)) >>> 0; // mod 2^32
  const { jumpTable, basicBlockStarts } = s.context ?? {};
  console.log("JumpInd operands:", { rA, immOffset, address, jumpTable, basicBlockStarts });
  if (!jumpTable || !basicBlockStarts) return panic(s);

  const { exitReason, pc } = djump(address, jumpTable, basicBlockStarts);

  return {
    ...s,
    pc,
    gas: s.gas - GAS_COST_JUMP_IND,
    exit: { type: exitReason },
  };
};

// 51
const loadImmHandler: ExecutionHandler = (state, [rA, imm]) => {
  const registers = state.registers.slice();
  registers[rA] = BigInt(imm);

  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
};

// 52
const loadU8Handler: ExecutionHandler = (state, [rA, imm]) => {
  const addr = Number(imm);
  if (addr < 0 || addr >= state.memory.length) return panic(state);

  const value = BigInt(state.memory[addr]);
  const registers = state.registers.slice();
  registers[rA] = value;

  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
};

// 53
const loadI8Handler: ExecutionHandler = (state, [rA, imm]) => {
  const addr = Number(imm);
  if (addr < 0 || addr >= state.memory.length) return panic(state);

  
  const value = BigInt.asIntN(8, 0x80n); // 0x80n is the sign bit for 8-bit signed integers
  const registers = state.registers.slice();
  registers[rA] = value;

  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
}


// 54
const loadU16Handler: ExecutionHandler = (state, [rA, imm]) => {
  const addr = Number(imm);
  if (addr < 0 || addr + 1 >= state.memory.length) return panic(state);
  const lowerByte = state.memory[addr];
  const upperByte = state.memory[addr + 1];
  const value = BigInt(lowerByte) | (BigInt(upperByte) << 8n);
  const registers = state.registers.slice();
  registers[rA] = value;
  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
};

//55
const loadI16Handler: ExecutionHandler = (state, [rA, imm]) => {
  const addr = Number(imm);
  if (addr < 0 || addr + 1 >= state.memory.length) return panic(state);
  
  const lowerByte = state.memory[addr];
  const upperByte = state.memory[addr + 1];

  // asIntN(8, 0x80n) but for 16 bits. 
  // Shift the value to the left by 48 bits
  // 
  const value = BigInt.asIntN(16, (BigInt(lowerByte) | (BigInt(upperByte) << 8n)) << 48n >> 48n); // sign extend to 64 bits
  const registers = state.registers.slice();
  registers[rA] = value;
  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
};

// 56
const loadU32Handler: ExecutionHandler = (state, [rA, imm]) => {
  const addr = Number(imm);
  if (addr < 0 || addr + 3 >= state.memory.length) return panic(state);
  
  const lowerByte = state.memory[addr];
  const secondByte = state.memory[addr + 1];
  const thirdByte = state.memory[addr + 2];
  const upperByte = state.memory[addr + 3];
  
  // BigInts and shifts to create a little-endian 32-bit value
  const value = BigInt(lowerByte) | // unshifted
                (BigInt(secondByte) << 8n) | ( // shifted by 8 bits
                BigInt(thirdByte) << 16n) | // shifted by 16 bits
                (BigInt(upperByte) << 24n); //  shifted by 24 bits
  
  const registers = state.registers.slice();
  registers[rA] = value;
  
  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
}

// 57
const loadI32Handler: ExecutionHandler = (state, [rA, imm]) => {
  const addr = Number(imm);
  if (addr < 0 || addr + 3 >= state.memory.length) return panic(state);
  
  const lowerByte = state.memory[addr];
  const secondByte = state.memory[addr + 1];
  const thirdByte = state.memory[addr + 2];
  const upperByte = state.memory[addr + 3];
  
  // BigInt.asIntN(32, val32)
  const value = BigInt.asIntN( 32,
                (BigInt(lowerByte) | 
                (BigInt(secondByte) << 8n) | 
                (BigInt(thirdByte) << 16n) | 
                (BigInt(upperByte) << 24n)) << 32n >> 32n
  ); // sign extend to 64 bits
  
  const registers = state.registers.slice();
  registers[rA] = value;
  
  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
};

// 58
const loadU64Handler: ExecutionHandler = (state, [rA, imm]) => {
  const addr = Number(imm);
  if (addr < 0 || addr + 7 >= state.memory.length) return panic(state);

  // read 8 bytes from memory
  const bytes = state.memory.slice(addr, addr + 8);
  const value = BigInt(
    bytes.reduce((acc, byte, index) => acc | (BigInt(byte) << BigInt(index * 8)), 0n)
  );
  const registers = state.registers.slice();
  registers[rA] = value;
  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - 1,
    exit: undefined,
  };
};

// factory function for store handlers
const store = (bytes: 1 | 2 | 4 | 8 ): ExecutionHandler =>
  (s,[rA, imm]) => {
    const a = Number(imm);
    if (a < 0 || a + (bytes - 1) >= s.memory.length) return panic(s);
 
    const mem = s.memory.slice();
    const val = s.registers[rA];

    for (let i = 0; i < bytes; i++)
      mem[a+i] = Number((val >> (8n * BigInt(i))) & 0xffn);
 
    return { 
      ...s, 
      memory: mem, 
      pc: nextPc(s),
      gas: s.gas - GAS_PER_INSTRUCTION,
      exit: undefined,
    };
  };

// 59 - 62
const storeU8Handler  = store(1);
const storeU16Handler = store(2);
const storeU32Handler = store(4);
const storeU64Handler = store(8);


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
  [Opcodes.jump_ind]: jumpIndHandler,
  [Opcodes.load_imm]: loadImmHandler,
  [Opcodes.load_u8]: loadU8Handler,
  [Opcodes.load_i8]: loadI8Handler,
  [Opcodes.load_u16]: loadU16Handler,
  [Opcodes.load_i16]: loadI16Handler,
  [Opcodes.load_u32]: loadU32Handler,
  [Opcodes.load_i32]: loadI32Handler,
  [Opcodes.load_u64]: loadU64Handler,
  [Opcodes.store_u8]: storeU8Handler,
  [Opcodes.store_u16]: storeU16Handler,
  [Opcodes.store_u32]: storeU32Handler,
  [Opcodes.store_u64]: storeU64Handler,

};
