import { JUMP_ALIGNMENT_FACTOR } from "../consts";
import { ExitReasonType, InterpreterState } from "../types";

type DjumpResult = { exitReason: ExitReasonType; pc: number };

// (A.18) from protocol spec 
export function djump(a: number, jumpTable: number[], basicBlockStarts: Set<number>): DjumpResult {
  const DBG = process.env.JAM_DEBUG_STEP === "1";
  if (DBG) {
    console.log("Executing djump with a:", a, "jumpTable length:", jumpTable.length, "basicBlockStarts size:", basicBlockStarts.size);
  }

  // first condition of djump function
  if (a === (2**32 - 2**16)) { // 2**32 means 
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

  if (DBG) {
    console.log("[djump] jumpTableIndex:", jumpTableIndex, "targetPc:", targetPc, "isInBB:", basicBlockStarts.has(targetPc), "jumpTable[148..152]:", jumpTable.slice(148, 153));
  }

  if (!basicBlockStarts.has(targetPc)) {
    if (DBG) {
      console.log("[djump] PANIC - target not in basicBlockStarts. First 20 BB starts:", Array.from(basicBlockStarts).slice(0, 20));
    }
    return { exitReason: ExitReasonType.Panic, pc: 0 };
  }

  // or third condition of djump function
  return { exitReason: ExitReasonType.Continue, pc: targetPc };
}

export function ensureOpcodeBoundary(s: InterpreterState, target: number): number {
  if (target < 0 || target >= s.code.length) {
    (s as any).exit = { type: ExitReasonType.Panic, detail: `jump OOB: ${target}/${s.code.length}` };
    throw new Error("jump OOB");
  }

  // IMPORTANT: opcodeMaskBits is boolean[] (from bitmaskToBoolean)
  const bits = s.opcodeMaskBits as unknown as boolean[];
  if (!bits[target]) {
    (s as any).exit = { type: ExitReasonType.Panic, detail: `jump to non-opcode byte: pc=${target}` };
    throw new Error("jump to non-opcode byte");
  }
  return target;
}