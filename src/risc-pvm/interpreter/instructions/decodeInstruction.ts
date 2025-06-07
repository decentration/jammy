import { decodeImmediate32, decodeImmediate64, decodeOffset, decodeSignedIntLE, immediateLength } from "../utils/helpers";
import { Instruction, InstructionAddressTypes, OpcodeTable, Opcodes } from "./opcodes";

/*
  * Decodes an instruction from the given memory at the specified program counter (pc).
  * 
  * @param memory - The byte array containing the instruction opcodes.
  * @param pc - The program counter indicating the position in the memory to decode.
  * @returns An Instruction object containing the type, opcode, and operands.
  */
export function decodeInstruction(memory: Uint8Array, pc: number): Instruction {
  console.log("Decoding instruction at pc:", {memory, pc});
    const opcode = memory[pc];
    const type = OpcodeTable[opcode as Opcodes];
    console.log("Decoded opcode:", {opcode, type});
    const skipLen = memory.length - (pc + 1);


    let instruction: Instruction = { type, opcode, operands: [] };

    switch (type) {
        case InstructionAddressTypes.NO_OPERAND:
          instruction.operands = [];
          break;
    
        case InstructionAddressTypes.ONE_IMMEDIATE: {
          const lX = immediateLength(skipLen); // lX is length in bytes of first immediate. Derived from upper nibble
          const immBytes = memory.slice(pc + 1, pc + 1 + lX);
          instruction.operands = [decodeImmediate32(immBytes)];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_ONE_EXTENDED_IMMEDIATE: {
          const reg = memory[pc + 1];
          const immBytes = memory.slice(pc + 2, pc + 10); // 8 bytes
          instruction.operands = [reg, decodeImmediate64(immBytes)];
          break;
        }
    
        case InstructionAddressTypes.TWO_IMMEDIATE: {
          // A.22 clearly defined:
          const lX = Math.min(4, memory[pc + 1] % 8);
          const immXBytes = memory.slice(pc + 2, pc + 2 + lX);
          const vX = decodeSignedIntLE(immXBytes);
    
          const lY = Math.min(4, Math.max(0, skipLen - lX - 1)); // lY is length in bytes of second immediate. Calculated from remaining bytes
          const immYBytes = memory.slice(pc + 2 + lX, pc + 2 + lX + lY);
          const vY = decodeSignedIntLE(immYBytes);
    
          instruction.operands = [vX, vY];
          break;
        }
    
        case InstructionAddressTypes.ONE_OFFSET: {
          // A.23 
          const lX = immediateLength(skipLen);
          const offsetBytes = memory.slice(pc + 1, pc + 1 + lX);
          const offset = decodeOffset(pc, offsetBytes);
    
          instruction.operands = [offset];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE: {
          // A.24 
          const rA = memory[pc + 1] % 16;
          const lX = immediateLength(skipLen - 1);
          const immBytes = memory.slice(pc + 2, pc + 2 + lX);
          const imm = decodeSignedIntLE(immBytes);
    
          instruction.operands = [rA, imm];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE: {
          // A.25 
          const rA = memory[pc + 1] % 16;
          const lX = Math.min(4, Math.floor(memory[pc + 1] / 16) % 8);
          const immXBytes = memory.slice(pc + 2, pc + 2 + lX);
          const immX = decodeSignedIntLE(immXBytes);
    
          const lY = Math.min(4, Math.max(0, skipLen - lX - 1));
          const immYBytes = memory.slice(pc + 2 + lX, pc + 2 + lX + lY);
          const immY = decodeSignedIntLE(immYBytes);
    
          instruction.operands = [rA, immX, immY];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET: {

          console.log("Decoding ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET instruction", {pc, skipLen, memory});
          // A.26 
          const rA = memory[pc + 1] % 16;
          const lX = Math.min(4, Math.floor(memory[pc + 1] / 16) % 8);
          const immBytes = memory.slice(pc + 2, pc + 2 + lX);
          console.log("immBytes", immBytes);
          const imm = decodeSignedIntLE(immBytes);
    
          const lY = Math.min(4, Math.max(0, skipLen - lX - 1));
          const offsetBytes = memory.slice(pc + 2 + lX, pc + 2 + lX + lY);
          const offset = decodeOffset(pc, offsetBytes);
    
          instruction.operands = [rA, imm, offset];
          break;
        }
    
        case InstructionAddressTypes.TWO_REGISTERS: {
          // A.27 
          const rD = memory[pc + 1] % 16;
          const rA = Math.floor(memory[pc + 1] / 16);
          instruction.operands = [rD, rA];
          break;
        }
    
        case InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE: {
          // A.28 
          const rA = memory[pc + 1] % 16;
          const rB = Math.floor(memory[pc + 1] / 16);
          const lX = immediateLength(skipLen - 1);
          const immBytes = memory.slice(pc + 2, pc + 2 + lX);
          const imm = decodeSignedIntLE(immBytes);
    
          instruction.operands = [rA, rB, imm];
          break;
        }
    
        case InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET: {
          // A.29 
          const rA = memory[pc + 1] % 16;
          const rB = Math.floor(memory[pc + 1] / 16);
          const lX = immediateLength(skipLen - 1);
          const offsetBytes = memory.slice(pc + 2, pc + 2 + lX);
          const offset = decodeOffset(pc, offsetBytes);
    
          instruction.operands = [rA, rB, offset];
          break;
        }
    
        case InstructionAddressTypes.TWO_REGISTERS_TWO_IMMEDIATE: {
          // A.30 
          const rA = memory[pc + 1] % 16;
          const rB = Math.floor(memory[pc + 1] / 16);
          const lX = Math.min(4, memory[pc + 2] % 8);
          const immXBytes = memory.slice(pc + 3, pc + 3 + lX);
          const immX = decodeSignedIntLE(immXBytes);
    
          const lY = Math.min(4, Math.max(0, skipLen - lX - 2));
          const immYBytes = memory.slice(pc + 3 + lX, pc + 3 + lX + lY);
          const immY = decodeSignedIntLE(immYBytes);
    
          instruction.operands = [rA, rB, immX, immY];
          break;
        }
    
        case InstructionAddressTypes.THREE_REGISTERS: {
          // A.31 
          const rA = memory[pc + 1] % 16;
          const rB = Math.floor(memory[pc + 1] / 16);
          const rD = memory[pc + 2] % 16;
    
          instruction.operands = [rA, rB, rD];
          break;
        }
    
        default:
          throw new Error(`Unhandled instruction address type: ${type}`);
      }

    return instruction;

}

