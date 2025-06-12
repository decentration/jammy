import { JUMP_ALIGNMENT_FACTOR } from "../consts";
import { ExitReasonType } from "../types";

type DjumpResult = { exitReason: ExitReasonType; pc: number };

// (A.18) from protocol spec 
export function djump(a: number, jumpTable: number[], basicBlockStarts: Set<number>): DjumpResult {

  // first condition of djump function
  if (a === (2**32 - 2**16)) {
    return { exitReason: ExitReasonType.Halt, pc: 0 };
  }


  // second confition of djump function
  if ( a === 0 || a % JUMP_ALIGNMENT_FACTOR !== 0 ||
    (a / JUMP_ALIGNMENT_FACTOR - 1) < 0 ||
    (a / JUMP_ALIGNMENT_FACTOR - 1) >= jumpTable.length
  ) {
    return { exitReason: ExitReasonType.Panic, pc: 0 };
  }

  const jumpTableIndex = (a / JUMP_ALIGNMENT_FACTOR) - 1;
  const targetPc = jumpTable[jumpTableIndex];

  if (!basicBlockStarts.has(targetPc)) {
    return { exitReason: ExitReasonType.Panic, pc: 0 };
  }

  // or third condition of djump function
  return { exitReason: ExitReasonType.Continue, pc: targetPc };
}