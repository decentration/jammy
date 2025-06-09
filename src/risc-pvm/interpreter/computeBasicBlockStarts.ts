import { TERMINATION_OPCODES } from "./instructions/opcodes";
import { skip } from "./utils/skip";


/**
 * A.3. Computes the starting indices of basic blocks in a sequence of instructions.
 * A basic block starts at the first instruction and at every instruction that is followed by a termination opcode.
 * 
 * What are basic blocks?
 * 
 * From the epsec: A.3. Basic Blocks and Termination Instructions. Instructions of the following opcodes are considered basic-block
 * termination instructions; other than trap & fallthrough, they correspond to instructions which may define the instruction-
 * counter to be something other than its prior value plus the instruction’s skip amount:
 * ● Trap and fallthrough: trap , fallthrough
 * ● Jumps: jump , jump_ind
 * ● Load-and-Jumps: load_imm_jump , load_imm_jump_ind
 * ● Branches: branch_eq , branch_ne , branch_ge_u , branch_ge_s , branch_lt_u , branch_lt_s , branch_eq_imm ,
 * branch_ne_imm
 * ● Immediate branches: branch_lt_u_imm , branch_lt_s_imm , branch_le_u_imm , branch_le_s_imm , branch_ge_u_imm ,
 * branch_ge_s_imm , branch_gt_u_imm , branch_gt_s_imm
 *
 * @param instructionData - The byte array containing the instruction opcodes.
 * @param opcodeBits - A boolean array indicating whether each byte in `instructionData` is an opcode (`true`) or an operand (`false`).
 * @returns A Set containing the starting indices of basic blocks.
 */
export function computeBasicBlockStarts(instructionData: Uint8Array, opcodeBits: boolean[]): Set<number> {
  console.log("Computing basic block starts...", { instructionData, opcodeBits });
    const basicBlockStarts = new Set<number>([0]); 
  
    let pc = 0;
    while (pc < instructionData.length) {
      const opcode = instructionData[pc];
      const instructionSkip = skip(pc, opcodeBits);
      console.log("Instruction skip", instructionSkip)
      console.log(`Processing opcode at pc=${pc}: ${opcode} (skip=${instructionSkip})`);
      if (TERMINATION_OPCODES.has(opcode)) {
        console.log("TERMINATION_OPCODES has opcode", opcode )
        const nextBlockStart = pc + 1 + instructionSkip;
        console.log("Next block start:", nextBlockStart);
        if (nextBlockStart < instructionData.length && opcodeBits[nextBlockStart]) {
          console.log("next block start is less than instruction length and opcode bits of next block start", nextBlockStart, opcodeBits[nextBlockStart])
          basicBlockStarts.add(nextBlockStart);
        }
      }
      pc += 1 + instructionSkip;
    }
  console.log("Computed basic block starts:", basicBlockStarts);
  
    return basicBlockStarts;
  }