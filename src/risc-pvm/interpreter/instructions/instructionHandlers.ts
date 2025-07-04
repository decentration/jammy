import { skip } from "../utils/skip";
import { ExecutionHandler, ExitReasonType, InterpreterState } from "../types";
import { Opcodes } from "./opcodes";
import { branch } from "../utils/branch";
import { GAS_PER_INSTRUCTION, GAS_COST_JUMP, GAS_COST_JUMP_IND } from "../consts";
import { djump } from "../utils/djump";

export function nextPc(state: InterpreterState): number {

  const opBytes = skip(state.pc, state.opcodeMaskBits);
  console.log("Next PC calculation:", {
    pc: state.pc,
    opBytes,
    nextPc: state.pc + 1 + opBytes,
  });

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
    console.log("Branch Handler called with operands:", { rA, imm, offset });
    const basicBlockStarts = state.context?.basicBlockStarts;
    if (!basicBlockStarts) return panic(state);

    const regVal = state.registers[rA];
    const immVal = BigInt(imm);
    const shouldBranch = condition(regVal, immVal);
    const targetPc = state.pc + Number(offset);
    console.log("Branch Handler:", { targetPc, shouldBranch, regVal, immVal, rA, offset });

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
  gas  : s.gas - 10, // decrement gas by host-call rate
  exit : { type: ExitReasonType.HostCall, id: BigInt(imm) },  // immediate passed
});

export const loadImm64Handler: ExecutionHandler = (s, [rA, imm]) => {
  const registers = s.registers.slice();
  registers[rA] = imm as bigint;
  return {
    ...s,
    registers,
    pc: s.pc + 10,
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

//101 -> Set Break
const sbrkHandler: ExecutionHandler = (state, [rD, rA]) => {
  const requestedSize = Number(state.registers[rA]);

  if (requestedSize < 0) {
    return { ...state, exit: { type: ExitReasonType.Panic, detail: "sbrk negative" } };
  }

  const heapStart = state.context?.heapStart ?? 0;  // Assume heapStart from context
  const heapPointer = state.context?.heapPointer ?? heapStart;
  const heapEnd = state.context?.heapEnd ?? state.memory.length; // Assume heapEnd is the end of memory

  const newHeapPointer = heapPointer + requestedSize;

  if (newHeapPointer > heapEnd) {
    return { ...state, exit: { type: ExitReasonType.Panic, detail: "heap overflow" } };
  }

  const registers = state.registers.slice();
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
    exit: { type: ExitReasonType.Continue },
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

// Store indirect ops
// storeInd for indirect memory access, where the address is computed from a base register and an immediate offset
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



// Load indirect ops
const loadIndU8Handler  = loadInd(1, false);  // 124
const loadIndI8Handler  = loadInd(1, true);   // 125
const loadIndU16Handler = loadInd(2, false);  // 126
const loadIndI16Handler = loadInd(2, true);   // 127
const loadIndU32Handler = loadInd(4, false);  // 128
const loadIndI32Handler = loadInd(4, true);   // 129
const loadIndU64Handler = loadInd(8, false);  // 130

const twoRegImmOp = (fn: (regVal: bigint, imm: bigint) => bigint): ExecutionHandler =>
  (state, [rA, rB, imm]) => {
    const registers = state.registers.slice();
    registers[rA] = fn(registers[rB], imm);
    return { ...state, registers, pc: nextPc(state), gas: state.gas - GAS_PER_INSTRUCTION, exit: { type: ExitReasonType.Continue } };
  };

// twoRegImmOp: Arithmetic and logical using twoRegImmOp
const addImm32Handler    = twoRegImmOp((a, imm) => (a + imm) & 0xFFFFFFFFn); // 131
const andImmHandler      = twoRegImmOp((a, imm) => a & imm);                 // 132
const xorImmHandler      = twoRegImmOp((a, imm) => a ^ imm);             // XOR 133
const orImmHandler       = twoRegImmOp((a, imm) => a | imm);              // OR 134
const mulImm32Handler    = twoRegImmOp((a, imm) => (a * imm) & 0xFFFFFFFFn); // 135

// less than (signed and unsigned)
// const set_lt_u_imm = setCompareImm((a, b) => a < b); // 136

// opcode 136 (unsigned less than immediate)
const setLtUImmHandler: ExecutionHandler = (state, [rA, rB, imm]) => ({
  ...state,
  registers: state.registers.with(rA, state.registers[rB] < BigInt(imm) ? 1n : 0n),
  pc: nextPc(state),
  gas: state.gas - GAS_PER_INSTRUCTION,
  exit: { type: ExitReasonType.Continue },

});

// opcode 137 (signed less than immediate)
const setLtSImmHandler: ExecutionHandler = (state, [rA, rB, imm]) => ({
  ...state,
  registers: state.registers.with(
    rA,
    BigInt.asIntN(64, state.registers[rB]) < BigInt.asIntN(64, BigInt(imm)) ? 1n : 0n,
  ),
  pc: nextPc(state),
  gas: state.gas - GAS_PER_INSTRUCTION,
  exit: { type: ExitReasonType.Continue },

}); // 137

// opcode 138 shift left logical immediate 32 bits
const shloLImm32Handler = twoRegImmOp((rB, imm) => ((rB << BigInt(imm % 32n)) & 0xFFFFFFFFn)); // 138


// opcode 139 shift right logical immediate 32 bits
const shloRImm32Handler = twoRegImmOp((rB, imm) => ((rB & 0xFFFFFFFFn) >> BigInt(imm % 32n))); // 139

// opcode 140: shift right arithmetic immediate 32 bits
const sharRImm32Handler = twoRegImmOp((rB, imm) => 
  BigInt.asIntN(32, rB & 0xFFFFFFFFn) >> BigInt(imm % 32n) // 140 
);

// opcode 141: negate and add immediate 32 bits
const negAddImm32Handler = twoRegImmOp((rB, imm) => (BigInt(imm) + (1n << 32n) - (rB & 0xFFFFFFFFn)) & 0xFFFFFFFFn); // 141


// greater than (signed and unsigned)
// opcode 142 (unsigned greater than immediate)
const setGtUImmHandler: ExecutionHandler = (state, [rA, rB, imm]) => ({
  ...state,
  registers: state.registers.with(rA, state.registers[rB] > BigInt(imm) ? 1n : 0n),
  pc: nextPc(state),
  gas: state.gas - GAS_PER_INSTRUCTION,
  exit: { type: ExitReasonType.Continue },
});

// opcode 143 (signed greater than immediate)
const setGtSImmHandler: ExecutionHandler = (state, [rA, rB, imm]) => ({
  ...state,
  registers: state.registers.with(
    rA,
    BigInt.asIntN(64, state.registers[rB]) > BigInt.asIntN(64, BigInt(imm)) ? 1n : 0n,
  ),
  pc: nextPc(state),
  gas: state.gas - GAS_PER_INSTRUCTION,
  exit: { type: ExitReasonType.Continue },
});

// opcode 144: shift left logical immediate alternative 32 bits
const shloLImmAlt32Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asUintN(32, BigInt(imm) << (rB & 0x1Fn)) // wrap-around shift for 32-bit integers
);

// opcode 145: shift right logical immediate alternative 32 bits
const shloRImmAlt32Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asUintN(32, BigInt(imm) >> (rB & 0x1Fn))
);

// opcode 146: shift right arithmetic immediate alternative 32 bits
const sharRImmAlt32Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asIntN(32, BigInt.asIntN(32, imm) >> (rB & 0x1Fn))
);


// 147
//  Moves the imm value to destination register rA if source rB is exactly zero, else destination is left unchanged
const cmovIzImmHandler: ExecutionHandler = (state, [rA, rB, imm]) => {
  const registers = state.registers.slice();

  // Check if the source register rB is zero
  registers[rA] = registers[rB] === 0n ? imm : registers[rA];

  return { 
    ...state, 
    registers, 
    pc: nextPc(state), 
    gas: state.gas - GAS_PER_INSTRUCTION, 
    exit: { type: ExitReasonType.Continue } 
  };
};

// 148
// Moves the imm value to destination register rA if source rB is not zero, else destination is left unchanged
const cmovNzImmHandler: ExecutionHandler = (state, [rA, rB, imm]) => {
  const registers = state.registers.slice();

  // Check if rB is not zero, if so, set rA to imm, else keep rA unchanged
  registers[rA] = registers[rB] !== 0n ? imm : registers[rA];

  return { 
    ...state, 
    registers, 
    pc: nextPc(state), 
    gas: state.gas - GAS_PER_INSTRUCTION, 
    exit: { type: ExitReasonType.Continue } 
  };
};


const addImm64Handler: ExecutionHandler = twoRegImmOp((a, imm) => (a + imm) & 0xFFFFFFFFFFFFFFFFn); // 149
const mulImm64Handler: ExecutionHandler = twoRegImmOp((a, imm) => (a * imm) & 0xFFFFFFFFFFFFFFFFn); // 150

const shloLImm64Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asUintN(64, rB << (imm & 0x3Fn))
); // 151

const shloRImm64Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asUintN(64, rB >> (imm & 0x3Fn))
); // 152

const sharRImm64Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asIntN(64, BigInt.asIntN(64, rB) >> (imm & 0x3Fn))
); // 153

const negAddImm64Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asUintN(64, (imm + (1n << 64n) - rB))
); // 154

const shloLImmAlt64Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asUintN(64, imm << (rB & 0x3Fn))
); // 155

const shloRImmAlt64Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asUintN(64, imm >> (rB & 0x3Fn))
); // 156

const sharRImmAlt64Handler: ExecutionHandler = twoRegImmOp(
  (rB, imm) => BigInt.asIntN(64, BigInt.asIntN(64, imm) >> (rB & 0x3Fn))
); // 157

const rotateR64ImmHandler: ExecutionHandler = twoRegImmOp((rB, imm) => {
  const shift = Number(imm & 0x3Fn);
  return BigInt.asUintN(64, (rB >> BigInt(shift)) | (rB << BigInt(64 - shift)));
}); // 158

const rotateR64ImmAltHandler: ExecutionHandler = twoRegImmOp((rB, imm) => {
  const shift = Number(rB & 0x3Fn);
  return BigInt.asUintN(64, (imm >> BigInt(shift)) | (imm << BigInt(64 - shift)));
}); // 159

const rotateR32ImmHandler: ExecutionHandler = twoRegImmOp((rB, imm) => {
  const shift = Number(imm & 0x1Fn);
  const val32 = BigInt.asUintN(32, rB);
  return BigInt.asUintN(32, (val32 >> BigInt(shift)) | (val32 << BigInt(32 - shift)));
}); // 160

const rotateR32ImmAltHandler: ExecutionHandler = twoRegImmOp((rB, imm) => {
  const shift = Number(rB & 0x1Fn);
  const val32 = BigInt.asUintN(32, imm);
  return BigInt.asUintN(32, (val32 >> BigInt(shift)) | (val32 << BigInt(32 - shift))); // 
}); // 161

const branchRegisterHandler = (
  condition: (regA: bigint, regB: bigint) => boolean
): ExecutionHandler => (state, [rA, rB, offset]) => {

  const basicBlockStarts = state.context?.basicBlockStarts;
  if (!basicBlockStarts) return panic(state);

  const regAVal = state.registers[rA];
  const regBVal = state.registers[rB];
  const shouldBranch = condition(regAVal, regBVal);
  const targetPc = state.pc + Number(offset);

  const { exitReason, pc } = branch(
    targetPc,
    shouldBranch,
    basicBlockStarts,
    nextPc(state)
  );

  return {
    ...state,
    pc,
    gas: state.gas - GAS_COST_JUMP,
    exit: { type: exitReason },
  };
};

const branchEqHandler = branchRegisterHandler((a, b) => a === b); // 170
const branchNeHandler = branchRegisterHandler((a, b) => a !== b); // 171
const branchLtUHandler = branchRegisterHandler((a, b) => a < b);  // 172
const branchLtSHandler = branchRegisterHandler((a, b) => BigInt.asIntN(64, a) < BigInt.asIntN(64, b));  // 173
const branchGeUHandler = branchRegisterHandler((a, b) => a >= b);  // 174
const branchGeSHandler = branchRegisterHandler((a, b) => BigInt.asIntN(64, a) >= BigInt.asIntN(64, b)); // 175

const loadImmJumpIndHandler: ExecutionHandler = (state, [rA, rB, immX, immY]) => {
  const registers = state.registers.slice();
  
  // Load immediate vX directly into rA
  registers[rA] = BigInt(immX);

  // Compute the indirect jump address as (wB + vY) mod 2^32
  const jumpIndex = Number((state.registers[rB] + BigInt(immY)) & 0xFFFFFFFFn);
  
  // djump via the jump table to find actual target pc
  const { pc, exitReason } = djump(jumpIndex, state.context!.jumpTable, state.context!.basicBlockStarts);

  return {
    ...state,
    registers,
    pc,
    gas: state.gas - 1,
    exit: { type: exitReason },  
  };
};

const threeRegOp = ( 
  fn: (a: bigint, b: bigint) => bigint,
  gas: number = GAS_PER_INSTRUCTION): ExecutionHandler =>
  (s, [rA, rB, rD]) => {
    const regs = s.registers.slice();
    regs[rD] = fn(regs[rA], regs[rB]);

    return {
      ...s,
      registers: regs,
      pc: nextPc(s),
      gas: s.gas - gas,
      exit: { type: ExitReasonType.Continue }
    };
  };

// mask BigInt to lowest 32 bits
const low32 = (x: bigint) => x & 0xFFFF_FFFFn;

// sign-extend lowest 32 bits to 64-bit BigInt
const toSigned32  = (x: bigint) => BigInt.asIntN(32, x);

const add32Handler = threeRegOp((a, b) => low32(a + b)); // 190
const sub32Handler = threeRegOp((a, b) => low32(a + (0x1_0000_0000n - low32(b)))); // 191
const mul32Handler = threeRegOp((a, b) => low32(a * b)); // 192
const divU32Handler = threeRegOp((a, b) => low32(b) === 0n ? 0xFFFF_FFFFn : low32(a) / low32(b)); // 193

// 194
const divS32Handler = threeRegOp((a, b) => {
  const a32 = toSigned32(a);
  const b32 = toSigned32(b);

  if (b32 === 0n) return 0xFFFF_FFFFn; // division-by-zero case
  if (a32 === -0x8000_0000n && b32 === -1n) return 0x8000_0000n; // special saturation case

  // Regular signed division, then converted back to unsigned 32-bit storage
  return low32(a32 / b32);
});

const remU32Handler = threeRegOp((a, b) => low32(b) === 0n ? low32(a) : low32(a) % low32(b)); // 195

// 196
const remS32Handler = threeRegOp((a, b) => {
  const A = toSigned32(a), B = toSigned32(b);
  if (B === 0n) return 0n;
  if (A === (-0x8000_0000n) && B === -1n) return 0n;
  return low32(BigInt.asIntN(32, A % B));
});

const shloL32Handler = threeRegOp((a, b) => low32(a << (b & 31n))); // 197
const shloR32Handler = threeRegOp((a, b) => low32(a) >> (b & 31n)); // 198

// 199
const sharR32Handler = threeRegOp((a, b) => {
  const a32 = toSigned32(a);
  return low32(a32 >> (b & 31n));
}); 

const low64 = (x: bigint) => x & 0xFFFFFFFFFFFFFFFFn;

const add64Handler = threeRegOp((a, b) => low64(a + b)); // 200
const sub64Handler = threeRegOp((a, b) => low64(a - b)); // 201
const mul64Handler = threeRegOp((a, b) => low64(a * b)); // 202
const divU64Handler = threeRegOp((a, b) => b === 0n ? 0xFFFFFFFFFFFFFFFFn : low64(a / b)); // 203

// 204
const divS64Handler = threeRegOp((a, b) => {
  const sa = toSigned64(a), sb = toSigned64(b);
  if (sb === 0n) return 0xFFFFFFFFFFFFFFFFn;
  if (sa === -0x8000000000000000n && sb === -1n) return sa;
  return low64(sa / sb);
});

const remU64Handler = threeRegOp((a, b) => b === 0n ? a : low64(a % b)); // 205

// 206
const remS64Handler = threeRegOp((a, b) => {
  const sa = toSigned64(a), sb = toSigned64(b);
  if (sa === -0x8000000000000000n && sb === -1n) return 0n;
  return low64(sa % sb);
});

const shloL64Handler = threeRegOp((a, b) => low64(a << (b % 64n))); // 207
const shloR64Handler = threeRegOp((a, b) => low64(a >> (b % 64n))); // 208
const sharR64Handler = threeRegOp((a, b) => toSigned64(a) >> (b % 64n)); // 209
const andHandler = threeRegOp((a, b) => a & b); // 210
const xorHandler = threeRegOp((a, b) => a ^ b); // 211
const orHandler = threeRegOp((a, b) => a | b); // 212
const mulUpperSSHandler = threeRegOp((a, b) => BigInt.asIntN(64, (BigInt.asIntN(64, a) * BigInt.asIntN(64, b)) >> 64n)); // 213
const mulUpperUUHandler = threeRegOp((a, b) => (a * b) >> 64n); // 214
const mulUpperSUHandler = threeRegOp((a, b) => BigInt.asIntN(64, (BigInt.asIntN(64, a) * b) >> 64n)); // 215
const setLtUHandler = threeRegOp((a, b) => (a < b ? 1n : 0n)); // 216
const setLtSHandler = threeRegOp((a, b) => (toSigned64(a) < toSigned64(b) ? 1n : 0n)); // 217

// 218
const cmovIzHandler: ExecutionHandler = (s, [rB, rA, rD]) => {
  const regs = s.registers.slice();
  if (regs[rB] === 0n) regs[rD] = regs[rA];
  return { ...s, registers: regs, pc: nextPc(s), gas: s.gas - GAS_PER_INSTRUCTION };
};

// 219
const cmovNzHandler: ExecutionHandler = (s, [rB, rA, rD]) => {
  const regs = s.registers.slice();
  if (regs[rB] !== 0n) regs[rD] = regs[rA];
  return { ...s, registers: regs, pc: nextPc(s), gas: s.gas - GAS_PER_INSTRUCTION };
};

const rotL64Handler = threeRegOp((a, b) => ((a << (b % 64n)) | (a >> (64n - (b % 64n)))) & 0xFFFF_FFFF_FFFF_FFFFn); // 220
const rotL32Handler = threeRegOp((a, b) => ((a << (b % 32n)) | (a >> (32n - (b % 32n)))) & 0xFFFF_FFFFn); // 221
const rotR64Handler = threeRegOp((a, b) => ((a >> (b % 64n)) | (a << (64n - (b % 64n)))) & 0xFFFF_FFFF_FFFF_FFFFn); // 222
const rotR32Handler = threeRegOp((a, b) => ((a >> (b % 32n)) | (a << (32n - (b % 32n)))) & 0xFFFF_FFFFn); // 223
const andInvHandler = threeRegOp((a, b) => a & (~b & 0xFFFF_FFFF_FFFF_FFFFn)); // 224
const orInvHandler  = threeRegOp((a, b) => a | (~b & 0xFFFF_FFFF_FFFF_FFFFn)); // 225
const xnorHandler   = threeRegOp((a, b) => ~(a ^ b) & 0xFFFF_FFFF_FFFF_FFFFn); // 226
const maxSignedHandler = threeRegOp((a, b) => BigInt.asIntN(64, a) > BigInt.asIntN(64, b) ? BigInt.asIntN(64, a) : BigInt.asIntN(64, b));
const maxUnsignedHandler = threeRegOp((a, b) => a > b ? a : b);
const minSignedHandler = threeRegOp((a, b) => BigInt.asIntN(64, a) < BigInt.asIntN(64, b) ? BigInt.asIntN(64, a) : BigInt.asIntN(64, b));
const minUnsignedHandler = threeRegOp((a, b) => a < b ? a : b);

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
  [Opcodes.add_imm_32]: addImm32Handler,
  [Opcodes.and_imm]: andImmHandler,
  [Opcodes.xor_imm]: xorImmHandler,
  [Opcodes.or_imm]: orImmHandler, 
  [Opcodes.mul_imm_32]: mulImm32Handler, // 135
  [Opcodes.set_lt_u_imm]: setLtUImmHandler, // 136
  [Opcodes.set_lt_s_imm]: setLtSImmHandler, // 137
  [Opcodes.shlo_l_imm_32]: shloLImm32Handler, // 138  
  [Opcodes.shlo_r_imm_32]: shloRImm32Handler, // 139
  [Opcodes.shar_r_imm_32]: sharRImm32Handler, // 140
  [Opcodes.neg_add_imm_32]: negAddImm32Handler, // 141
  [Opcodes.set_gt_u_imm]: setGtUImmHandler, // 142
  [Opcodes.set_gt_s_imm]: setGtSImmHandler, // 143
  [Opcodes.shlo_l_imm_alt_32]: shloLImmAlt32Handler, // 144
  [Opcodes.shlo_r_imm_alt_32]: shloRImmAlt32Handler, // 145
  [Opcodes.shar_r_imm_alt_32]: sharRImmAlt32Handler, // 146
  [Opcodes.cmov_iz_imm]: cmovIzImmHandler, // 147
  [Opcodes.cmov_nz_imm]: cmovNzImmHandler,
  [Opcodes.add_imm_64]: addImm64Handler,
  [Opcodes.mul_imm_64]: mulImm64Handler,
  [Opcodes.shlo_l_imm_64]: shloLImm64Handler, // 151
  [Opcodes.shlo_r_imm_64]: shloRImm64Handler, // 152
  [Opcodes.shar_r_imm_64]: sharRImm64Handler, // 153
  [Opcodes.neg_add_imm_64]: negAddImm64Handler, // 154
  [Opcodes.shlo_l_imm_alt_64]: shloLImmAlt64Handler, // 155
  [Opcodes.shlo_r_imm_alt_64]: shloRImmAlt64Handler, // 156
  [Opcodes.shar_r_imm_alt_64]: sharRImmAlt64Handler, // 157
  [Opcodes.rot_r_64_imm]: rotateR64ImmHandler, // 158
  [Opcodes.rot_r_64_imm_alt]: rotateR64ImmAltHandler, // 159
  [Opcodes.rot_r_32_imm]: rotateR32ImmHandler, // 160
  [Opcodes.rot_r_32_imm_alt]: rotateR32ImmAltHandler, // 161
  [Opcodes.branch_eq]: branchEqHandler, // 170
  [Opcodes.branch_ne]: branchNeHandler, // 171
  [Opcodes.branch_lt_u]: branchLtUHandler, // 172
  [Opcodes.branch_lt_s]: branchLtSHandler, // 173
  [Opcodes.branch_ge_u]: branchGeUHandler, // 174
  [Opcodes.branch_ge_s]: branchGeSHandler, // 175
  [Opcodes.load_imm_jump_ind]: loadImmJumpIndHandler, // 180
  [Opcodes.add_32]: add32Handler, // 190
  [Opcodes.sub_32]: sub32Handler, // 191
  [Opcodes.mul_32]: mul32Handler, // 192
  [Opcodes.div_u_32]: divU32Handler, // 193
  [Opcodes.div_s_32]: divS32Handler, // 194
  [Opcodes.rem_u_32]: remU32Handler, // 195
  [Opcodes.rem_s_32]: remS32Handler, // 196
  [Opcodes.shlo_l_32]: shloL32Handler, // 197
  [Opcodes.shlo_r_32]: shloR32Handler, // 198
  [Opcodes.shar_r_32]: sharR32Handler, // 199
  [Opcodes.add_64]: add64Handler, // 200
  [Opcodes.sub_64]: sub64Handler, // 201
  [Opcodes.mul_64]: mul64Handler, // 202
  [Opcodes.div_u_64]: divU64Handler, // 203
  [Opcodes.div_s_64]: divS64Handler, // 204
  [Opcodes.rem_u_64]: remU64Handler, // 205
  [Opcodes.rem_s_64]: remS64Handler, // 206
  [Opcodes.shlo_l_64]: shloL64Handler, // 207
  [Opcodes.shlo_r_64]: shloR64Handler, // 208
  [Opcodes.shar_r_64]: sharR64Handler, // 209
  [Opcodes.and]: andHandler, // 210
  [Opcodes.xor]: xorHandler, // 211
  [Opcodes.or]: orHandler, // 212
  [Opcodes.mul_upper_s_s]: mulUpperSSHandler, // 213
  [Opcodes.mul_upper_u_u]: mulUpperUUHandler, // 214
  [Opcodes.mul_upper_s_u]: mulUpperSUHandler, // 215
  [Opcodes.set_lt_u]: setLtUHandler, // 216
  [Opcodes.set_lt_s]: setLtSHandler, // 217
  [Opcodes.cmov_iz]: cmovIzHandler, // 218
  [Opcodes.cmov_nz]: cmovNzHandler, // 219
  [Opcodes.rot_l_64]: rotL64Handler, // 220
  [Opcodes.rot_l_32]: rotL32Handler, // 221
  [Opcodes.rot_r_64]: rotR64Handler, // 222
  [Opcodes.rot_r_32]: rotR32Handler, // 223
  [Opcodes.and_inv]: andInvHandler, // 224
  [Opcodes.or_inv]: orInvHandler, // 225
  [Opcodes.xnor]: xnorHandler, // 226
  [Opcodes.max]: maxSignedHandler, // 227
  [Opcodes.max_u]: maxUnsignedHandler, // 228
  [Opcodes.min]: minSignedHandler, // 229
  [Opcodes.min_u]: minUnsignedHandler, // 230

};
