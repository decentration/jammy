import { skip } from "../utils/skip";
import { ExecutionHandler, ExitReasonType, InterpreterState } from "../types";
import { Opcodes } from "./opcodes";
import { branch } from "../utils/branch";
import { GAS_PER_INSTRUCTION, GAS_HOST_CALL, GAS_COST_JUMP, GAS_COST_JUMP_IND } from "../consts";
import { djump } from "../utils/djump";

export function nextPc(state: InterpreterState): number {
  const opBytes = skip(state.pc, state.opcodeMaskBits);
  return state.pc + 1 + opBytes;
}

function panic(state: InterpreterState) {
  return { ...state, exit: { type: ExitReasonType.Panic } };
}


const branchHandler = (
  condition: (registerValue: bigint, immediateValue: bigint) => boolean,
  gasCost: number = GAS_COST_JUMP
): ExecutionHandler => {
  return (state, [rA, imm, offset]) => {
    const basicBlockStarts = state.context?.basicBlockStarts;
    if (!basicBlockStarts) return panic(state);

    const regVal = state.registers[rA];
    const immVal = BigInt(imm);
    const shouldBranch = condition(regVal, immVal);
    const targetPc = state.pc + Number(offset);

    const { exitReason, pc } = branch(
      targetPc,
      shouldBranch,
      basicBlockStarts,
      state.pc
    );


    return {
      ...state,
      pc: shouldBranch ? pc : nextPc(state), // CRITICAL FIX HERE
      gas: state.gas - gasCost,
      exit: { type: exitReason },
    };
  };
};


export const trapHandler: ExecutionHandler = (s) => ({
  ...s,
  gas  : s.gas - GAS_PER_INSTRUCTION,
  exit : { type: ExitReasonType.Panic },
});

export const fallthroughHandler: ExecutionHandler = (s) => ({
  ...s,
  pc   : s.pc + 1, // 1 byte instruction
  gas  : s.gas - GAS_PER_INSTRUCTION,
  exit : {type: ExitReasonType.Continue }, // continue execution
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
    exit: { type: ExitReasonType.Continue }
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
    exit: { type: ExitReasonType.Continue }
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
    exit: { type: ExitReasonType.Continue }
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
    exit: { type: ExitReasonType.Continue }
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
    exit: { type: ExitReasonType.Continue }
  };
};

const jumpHandler: ExecutionHandler = (state, [offset]) => {
  return branchHandler(() => true, GAS_COST_JUMP)(state, [0, 0, offset]);
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
    exit: { type: ExitReasonType.Continue },
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
    exit: { type: ExitReasonType.Continue },
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
    exit: { type: ExitReasonType.Continue },
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
    exit: { type: ExitReasonType.Continue },
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
    exit: { type: ExitReasonType.Continue },
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
    exit: { type: ExitReasonType.Continue },
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
    exit: { type: ExitReasonType.Continue },
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
    exit: { type: ExitReasonType.Continue },
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
      exit: { type: ExitReasonType.Continue },
    };
  };

// 59 - 62
const storeU8Handler  = store(1);
const storeU16Handler = store(2);
const storeU32Handler = store(4);
const storeU64Handler = store(8);


const storeImmInd = (bytes: 1 | 2 | 4 | 8): ExecutionHandler =>
  (s,[rA, immX, immY]) => {
    const base = Number(s.registers[rA]);
    const addr = base + Number(immX);

    if (addr < 0 || addr + (bytes - 1) >= s.memory.length) return panic(s);

    const mem = s.memory.slice();
    const val = BigInt(immY);

    for (let i = 0; i < bytes; i++) {
      mem[addr + i] = Number((val >> (8n * BigInt(i))) & 0xffn);
    }
    
    return {
      ...s,
      memory: mem,
      pc: nextPc(s),
      gas: s.gas - GAS_PER_INSTRUCTION,
      exit: { type: ExitReasonType.Continue },
    };
  };

const storeImmIndU8Handler  = storeImmInd(1);   // 70
const storeImmIndU16Handler = storeImmInd(2);   // 71
const storeImmIndU32Handler = storeImmInd(4);   // 72
const storeImmIndU64Handler = storeImmInd(8);   // 73

// A.5.8
// opcode 80: unconditional jump with immediate load
const loadImmJumpHandler: ExecutionHandler = (state, [rA, immX, offset]) => {
  const registers = state.registers.slice();
  registers[rA] = BigInt(immX);
  const targetPc = state.pc + Number(offset);

  const { exitReason, pc } = branch(
    targetPc,
    true, // always be branching
    state.context!.basicBlockStarts,
    nextPc(state)
  );

  return {
    ...state,
    registers,
    pc,
    gas: state.gas - 1,
    exit: { type: exitReason },  
  };
};

// Branch handlers for conditional branches
const branchEqImmHandler = branchHandler((reg, imm) => reg === imm); // 81
const branchNeImmHandler = branchHandler((reg, imm) => reg !== imm); // 82
const branchLtUImmHandler = branchHandler((reg, imm) => reg < imm);   // 83
const branchLeUImmHandler = branchHandler((reg, imm) => reg <= imm); // 84
const branchGeUImmHandler = branchHandler((reg, imm) => reg >= imm); // 85
const branchGtUImmHandler = branchHandler((reg, imm) => reg > imm); // 86

// Signed comparison
const toSigned64 = (value: bigint) => (value << 56n) >> 56n;

const branchLtSImmHandler = branchHandler((reg, imm) => toSigned64(reg) < toSigned64(imm)); // 87
const branchLeSImmHandler = branchHandler((reg, imm) => toSigned64(reg) <= toSigned64(imm)); // 88
const branchGeSImmHandler = branchHandler((reg, imm) => toSigned64(reg) >= toSigned64(imm)); // 89  
const branchGtSImmHandler = branchHandler((reg, imm) => toSigned64(reg) > toSigned64(imm)); // 90

// A.5.9 

//101
const sbrkHandler: ExecutionHandler = (state, [rD, rA]) => {
  const registers = state.registers.slice();
  const requestedSize = Number(state.registers[rA]);
  const heapStart = state.context?.heapStart ?? 0;  // Assume heapStart from context
  const heapPointer = state.context?.heapPointer ?? heapStart;

  const newHeapPointer = heapPointer + requestedSize;

  if (newHeapPointer > state.memory.length) {
    return { ...state, exit: { type: ExitReasonType.Panic } };
  }

  registers[rD] = BigInt(heapPointer);

  return {
    ...state,
    registers,
    pc: nextPc(state),
    gas: state.gas - GAS_PER_INSTRUCTION,
    context: {
      ...state.context!,
      heapPointer: newHeapPointer,
    },
    exit: undefined,
  };
};

// Factory for simple two-register handlers
// two register op takes in a function and returns an ExecutionHandler, and internally processes a bigtint, returns a bigint and stores in registers
const twoRegisterOp = (fn: (a: bigint) => bigint): ExecutionHandler =>  // fn takes a single bigint and returns a bigint

  (s, [rD, rA]) => {
    const registers = s.registers.slice();
    registers[rD] = fn(registers[rA]);

    return {
      ...s,
      registers,
      pc: nextPc(s),
      gas: s.gas - GAS_PER_INSTRUCTION,
      exit: { type: ExitReasonType.Continue },
    };
  };


const moveRegHandler = twoRegisterOp((a) => a); // 100
const countSetBits64Handler = twoRegisterOp((a) => BigInt(a.toString(2).replace(/0/g, '').length)); // 102
const countSetBits32Handler = twoRegisterOp((a) => BigInt((a & 0xFFFFFFFFn).toString(2).replace(/0/g, '').length)); // 103
const leadingZeroBits64Handler = twoRegisterOp((a) => BigInt(64 - a.toString(2).length)); // 104
const leadingZeroBits32Handler = twoRegisterOp((a) => BigInt(32 - (a & 0xFFFFFFFFn).toString(2).length)); // 105

const trailingZeroBits64Handler = twoRegisterOp((a) => {
  const bits = a.toString(2);
  return BigInt(bits.length - bits.replace(/0+$/, '').length);
}); // 106

const trailingZeroBits32Handler = twoRegisterOp((a) => {
  const bits = (a & 0xFFFFFFFFn).toString(2);
  return BigInt(bits.length - bits.replace(/0+$/, '').length);
}); // 107

const signExtend8Handler = twoRegisterOp((a) => BigInt.asIntN(8, a)); // 108
const signExtend16Handler = twoRegisterOp((a) => BigInt.asIntN(16, a)); // 109
const zeroExtend16Handler = twoRegisterOp((a) => a & 0xFFFFn); // 110

// 111
// Reverse bytes by shifting masking then shifting back to its new position. 
// we are flipping the bytes of an 8byte integer. 
// E.g. 0b00000001 makes 0b10000000
const reverseBytesHandler = twoRegisterOp((a) => {
  let val = 0n; // make a 64-bit integer to store the reversed value
  for (let i = 0; i < 8; i++) {
    val |= ((a >> BigInt(i * 8)) // |= is bitwise OR assignment, shifting the i-th byte to the right
    & 0xffn) /// mask 
    << BigInt((7 - i) * 8); // shifting left to its new position
 }
  return val;
});


// A.5.10

//storeInd for indirect memory access, where the address is computed from a base register and an immediate offset
const storeInd = (bytes: 1 | 2 | 4 | 8): ExecutionHandler =>
  (state, [rA, rB, imm]) => {
    const addr = Number(state.registers[rB]) + Number(imm);
    if (addr < 0 || addr + bytes > state.memory.length) return panic(state);

    const memory = state.memory.slice();
    let value = state.registers[rA];

    for (let i = 0; i < bytes; i++)
      memory[addr + i] = Number((value >> BigInt(8 * i)) & 0xFFn);

    return { ...state, memory, pc: nextPc(state), gas: state.gas - GAS_PER_INSTRUCTION, exit: { type: ExitReasonType.Continue } };
  };

const storeIndU8Handler  = storeInd(1); // 120
const storeIndU16Handler = storeInd(2); // 121
const storeIndU32Handler = storeInd(4); // 122
const storeIndU64Handler = storeInd(8); // 123

const loadInd = (bytes: 1 | 2 | 4 | 8, signed: boolean): ExecutionHandler =>
  (state, [rA, rB, imm]) => {
    const addr = Number(state.registers[rB]) + Number(imm);
    if (addr < 0 || addr + bytes > state.memory.length) return panic(state);

    let value = 0n;
    for (let i = 0; i < bytes; i++) 
      value |= BigInt(state.memory[addr + i]) << BigInt(8 * i);

    if (signed) 
      value = BigInt.asIntN(bytes * 8, value);

    const registers = state.registers.slice();
    registers[rA] = value;

    return { ...state, registers, pc: nextPc(state), gas: state.gas - GAS_PER_INSTRUCTION, exit: { type: ExitReasonType.Continue } };
  };

  // Load indirect ops (124-130)
  const loadIndU8Handler  = loadInd(1, false);  // 124
  const loadIndI8Handler  = loadInd(1, true);   // 125
  const loadIndU16Handler = loadInd(2, false);  // 126
  const loadIndI16Handler = loadInd(2, true);   // 127
  const loadIndU32Handler = loadInd(4, false);  // 128
  const loadIndI32Handler = loadInd(4, true);   // 129
  const loadIndU64Handler = loadInd(8, false);  // 130

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
  [Opcodes.store_imm_ind_u8]: storeImmIndU8Handler,
  [Opcodes.store_imm_ind_u16]: storeImmIndU16Handler,
  [Opcodes.store_imm_ind_u32]: storeImmIndU32Handler,
  [Opcodes.store_imm_ind_u64]: storeImmIndU64Handler,
  [Opcodes.load_imm_jump]: loadImmJumpHandler,
  [Opcodes.branch_eq_imm]: branchEqImmHandler,
  [Opcodes.branch_ne_imm]: branchNeImmHandler,
  [Opcodes.branch_lt_u_imm]: branchLtUImmHandler,
  [Opcodes.branch_le_u_imm]: branchLeUImmHandler,
  [Opcodes.branch_ge_u_imm]: branchGeUImmHandler,
  [Opcodes.branch_gt_u_imm]: branchGtUImmHandler,
  [Opcodes.branch_lt_s_imm]: branchLtSImmHandler,
  [Opcodes.branch_le_s_imm]: branchLeSImmHandler,
  [Opcodes.branch_ge_s_imm]: branchGeSImmHandler,
  [Opcodes.branch_gt_s_imm]: branchGtSImmHandler,
  [Opcodes.move_reg]: moveRegHandler,
  [Opcodes.sbrk]: sbrkHandler,
  [Opcodes.count_set_bits_64]: countSetBits64Handler,
  [Opcodes.count_set_bits_32]: countSetBits32Handler,
  [Opcodes.leading_zero_bits_64]: leadingZeroBits64Handler,
  [Opcodes.leading_zero_bits_32]: leadingZeroBits32Handler,
  [Opcodes.trailing_zero_bits_64]: trailingZeroBits64Handler,
  [Opcodes.trailing_zero_bits_32]: trailingZeroBits32Handler,
  [Opcodes.sign_extend_8]: signExtend8Handler,
  [Opcodes.sign_extend_16]: signExtend16Handler,
  [Opcodes.zero_extend_16]: zeroExtend16Handler,
  [Opcodes.reverse_bytes]: reverseBytesHandler,
  [Opcodes.store_ind_u8]: storeIndU8Handler,
  [Opcodes.store_ind_u16]: storeIndU16Handler,
  [Opcodes.store_ind_u32]: storeIndU32Handler,
  [Opcodes.store_ind_u64]: storeIndU64Handler,
  [Opcodes.load_ind_u8]: loadIndU8Handler,
  [Opcodes.load_ind_i8]: loadIndI8Handler,
  [Opcodes.load_ind_u16]: loadIndU16Handler,
  [Opcodes.load_ind_i16]: loadIndI16Handler,
  [Opcodes.load_ind_u32]: loadIndU32Handler,
  [Opcodes.load_ind_i32]: loadIndI32Handler,
  [Opcodes.load_ind_u64]: loadIndU64Handler,
  
};
