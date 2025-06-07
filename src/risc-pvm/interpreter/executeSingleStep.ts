import { decodeInstruction } from "./instructions/decodeInstruction";
import { instructionHandlers } from "./instructions/instructionHandler";
import { skip } from "./utils/skip";
import { ExitReasonType, InterpreterState } from "./types";


/* Executes a single step in the interpreter.
 * This function decodes the instruction at the current program counter (pc),
  * looks up the corresponding execution handler, and executes it.

  
  * @param state - The current interpreter state.
  * @return The updated interpreter state after executing the step.
 */
export function executeSingleStep(state: InterpreterState): InterpreterState {
    if (state.exit?.type !== ExitReasonType.Running) return state; // Explicit enum comparison
  
    // const opcode = state.code[state.pc];
    // const skipLength = skip(state.pc, state.opcodeMaskBits);
    // const operands = Array.from(state.code.slice(state.pc + 1, state.pc + 1 + skipLength));
    const instr = decodeInstruction(state.code, state.pc);

    const handler = instructionHandlers[instr.opcode];
  
    if (!handler) {
      return { ...state, exit: { type: ExitReasonType.Panic } }; // unknown opcode
    }
  
    const next = handler(state, instr.operands as any[]); 
    return next;
  }