import { decodeImmediate32, decodeImmediate64, decodeOffset, decodeSignedIntLE, immediateLength } from "../utils/helpers";
import { skip } from "../utils/skip";
import { Instruction, InstructionAddressTypes, OpcodeTable, Opcodes } from "./opcodes";

const readLE = (m: Uint8Array, start: number, len: number) => {
  let v = 0;
  for (let i = 0; i < len; i++) v |= (m[start + i] ?? 0) << (8 * i);
  return v >>> 0;
};

const readSignedLENumber = (m: Uint8Array, start: number, len: number): number => {
  let v = 0;
  for (let i = 0; i < len; i++) v |= (m[start + i] ?? 0) << (8 * i);
  const shift = 32 - 8 * len;   // sign-extend to 32-bit
  return (v << shift) >> shift;
};


/*
  * Decodes an instruction from the given memory at the specified program counter (pc).
  * 
  * @param memory - The byte array containing the instruction opcodes.
  * @param pc - The program counter indicating the position in the memory to decode.
  * @returns An Instruction object containing the type, opcode, and operands.
  */
export function decodeInstruction(memory: Uint8Array, pc: number, opcodeBits: boolean[]): Instruction {
  // console.log("Decoding instruction at pc:", {memory, pc});
    const opcode = memory[pc];
    const type = OpcodeTable[opcode as Opcodes];
    // console.log("Decoded opcode:", {opcode, type, pc});

    const length = skip(pc, opcodeBits); // length of the instruction in bytes
    // length field is always an unsigned nibble (0‥15) but spec clamps to <= 4.
    const len4 = (n: number) => Math.min(4, n);

    // top 4 bits (high-nibble) of a control byte
    const hi4 = (ctl: number) =>  ctl >>> 4;

    let instruction: Instruction = { type, opcode, operands: [] };

    switch (type) {
        case InstructionAddressTypes.NO_OPERAND:
          instruction.operands = [];
          break;
    
        case InstructionAddressTypes.ONE_IMMEDIATE: {
          const lX   = Math.min(4, length);         
          const immBytes = memory.subarray(pc + 1, pc + 1 + lX);
          instruction.operands = [decodeImmediate32(immBytes)];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_ONE_EXTENDED_IMMEDIATE: {
          const reg = memory[pc + 1];
          const immBytes = memory.subarray(pc + 2, pc + 10); // 8 bytes
          instruction.operands = [reg, decodeImmediate64(immBytes)];
          break;
        }
    
        case InstructionAddressTypes.TWO_IMMEDIATE: {
          // A.22:
          const ctl = memory[pc + 1];
          const lX  = Math.min(4,  ctl & 0x07); // low 3 bits of ctl clamp at 4 bytes
          const immXBytes = memory.subarray(pc +2, pc + 2 + lX);
          const vX = decodeSignedIntLE(immXBytes);

          let lY;
          if (opcode === Opcodes.store_imm_u64) {
            lY = 8; // always 8 bytes for store_imm_u64
          } else {
            lY = Math.min(4, Math.max(0, length - lX - 1)); 
          }          
          const immYStart = pc + 2 + lX;
          const immYBytes = memory.subarray(immYStart, immYStart + lY);
          const vY = decodeSignedIntLE(immYBytes);
    
          instruction.operands = [vX, vY];
          break;
        }
    
        case InstructionAddressTypes.ONE_OFFSET: {
          // A.23 
          const ctl = memory[pc + 1]; // control byte
          const lX    = len4(hi4(ctl));
          const offsetBytes = Math.min(4, ctl >>> 4);;
          const offRaw = readLE(memory, pc + 2, offsetBytes);

          // const offset = decodeOffset(pc, offsetBytes);
    
          instruction.operands = [offRaw, offsetBytes];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE: {
          // A.24 

          const ctl = memory[pc + 1]; // control byte
          const rA   =  ctl & 0x0F;
          const lX  = Math.min(4, Math.max(0, length - 1)); // length of immediate, capped at 4 bytes
          const immBytes = memory.subarray(pc + 2, pc + 2 + lX);
          const vX = decodeSignedIntLE(immBytes);
    
          instruction.operands = [rA, vX];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE: {
          // A.25 
          const ctl1  = memory[pc + 1];
          const rA =  ctl1 & 0x0F;                  // low nibble
          const rawLX = (ctl1 >>> 4) & 0x0F;        // high nibble
          const lX = Math.min(4, rawLX & 0x7);      // mod 8 then <= 4
        
          // first immediate (vX)
          const xStart    = pc + 2;
          const xEnd      = xStart + lX;
          const immX       = decodeSignedIntLE(memory.subarray(xStart, xEnd));

          // second immediate (vY)
          const lY = Math.min(4, Math.max(0, length - lX));
          const yEnd = xEnd + lY;
          const immY = decodeSignedIntLE(memory.subarray(xEnd, yEnd));

    
          instruction.operands = [rA, immX, immY];
          break;
        }
    
        case InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET: {
          // A.26 
          const ctl = memory[pc + 1];
          const rA  =  ctl & 0x0F;
          const lX  = Math.min(4, (ctl >>> 4) & 0x07);
        
          const immBytes = memory.subarray(pc + 2, pc + 2 + lX);
          const vX = decodeSignedIntLE(immBytes);
        
          // FIX: length is skip(pc,k) = mode(1) + lX + lY
          // so lY = length - 1 - lX, clamped to 1..4
          const lY  = Math.max(1, Math.min(4, length - 1 - lX));
        
          const off = readSignedLENumber(memory, pc + 2 + lX, lY);
        
          instruction.operands = [rA, vX, off];
          break;
        }
        
        
    
        case InstructionAddressTypes.TWO_REGISTERS: {
          // A.27 
          const rD = memory[pc + 1] % 16;
          const rA = Math.floor(memory[pc + 1] / 16);
          instruction.operands = [rD, rA];
          break;
        }
    
        // case InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE: {
        //   // A.28 
        //   const rA = memory[pc + 1] % 16; // lower nibble is rA
        //   const rB = Math.floor(memory[pc + 1] / 16); // upper nibble is rB
        //   const lX = immediateLength(skipLen - 2); // 
        //   console.log("Decoding TWO_REGISTERS_ONE_IMMEDIATE instruction", {rA, rB, lX, pc, skipLen});
        //   const immBytes = memory.subarray(pc + 2, pc + 2 + lX);
        //   const imm = decodeSignedIntLE(immBytes);
        //   console.log("Decoded TWO_REGISTERS_ONE_IMMEDIATE instruction", {rA, rB, imm, immBytes});
    
        //   instruction.operands = [rA, rB, imm];
        //   break;
        // }

        case InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE: {
          // regByte: high nibble = rB, low nibble = rA
          const reg = memory[pc + 1];

          const isAlt =
          opcode === Opcodes.rot_r_64_imm_alt || // 159
          opcode === Opcodes.rot_r_32_imm_alt;   // 161

          if (isAlt) {
            // ALT packing:
            // bits 7..6 : lX (0..3)  -> imm length = lX + 1 (=> 1..4 bytes)
            // bits 5..4 : rB (2 bits)
            // bits 3..0 : rA (4 bits)
            const lXbits = (reg >>> 6) & 0x03;
            const immLen = (lXbits + 1); // 1..4
            const rB     = (reg >>> 4) & 0x03;
            const rA     =  reg        & 0x0F;
        
            const imm = decodeSignedIntLE(memory.subarray(pc + 2, pc + 2 + immLen));
            instruction.operands = [rA, rB, imm];
            break;
        
          }

          const rA = reg & 0xF;          // low-4 bits
          const rB = (reg >>> 4) & 0x0F;   // 
        
          const immLen  = Math.min(4, Math.max(1, length - 2));          
          const immBytes = memory.subarray(pc + 2, pc + 2 + immLen);
          const imm     = decodeSignedIntLE(immBytes);
          console.log("Decoded TWO_REGISTERS_ONE_IMMEDIATE instruction", {rA, rB, imm, immBytes});

          instruction.operands = [rA, rB, imm];
          break;
        }
    
        case InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET: {
          // A.29 
          const ctl = memory[pc + 1];
          const rA = ctl & 0x0F;
          const rB = (ctl >>> 4) & 0x0F;

          // const lX = Math.min(4, Math.max(0, length - 1));          
          
          const offLen = Math.max(1, Math.min(4, length - 2));
          const off    = readSignedLENumber(memory, pc + 2, offLen);
          instruction.operands = [rA, rB, off];
          break;
        }
    
        case InstructionAddressTypes.TWO_REGISTERS_TWO_IMMEDIATE: {
          // A.30 
          const ctl = memory[pc + 1];
          const rA = ctl & 0x0F;             // low nibble
          const rB = (ctl >>> 4) & 0x0F;      // high nibble
          
          // cap at 12
          const regA = Math.min(12, rA);
          const regB = Math.min(12, rB);

          // lenth of vX, |vX|
          const lenCtl = memory[pc + 2];
          const rawLX = lenCtl & 0x07;
          const lX = Math.min(4, rawLX);  // length in bytes of first immediate, derived from upper nibble 
          
          // vX (first imm)
          const immXBytes = memory.subarray(pc + 3, pc + 3 + lX);
          const immX = decodeSignedIntLE(immXBytes);
    
          // lY & vY
          const lY = Math.min(4, Math.max(0, length - lX - 2));
          const immYBytes = memory.subarray(pc + 3 + lX, pc + 3 + lX + lY);
          const immY = decodeSignedIntLE(immYBytes);
    
          instruction.operands = [regA, regB, immX, immY];
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

