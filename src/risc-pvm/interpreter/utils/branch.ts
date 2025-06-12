import { ExitReasonType } from "../types";

export function branch(targetPc: number, shouldBranch: boolean, basicBlockStarts: Set<number>, currentPc: number): { exitReason: ExitReasonType, pc: number } {
    if (!shouldBranch) {
      console.log(`Branching to ${targetPc} is not allowed, condition is false.`);
      // Condition false: no branch
      return { exitReason: ExitReasonType.Continue, pc: currentPc };
    } else if (!basicBlockStarts.has(targetPc)) {
      console.log(`Branching to ${targetPc} is invalid, not a basic block start.`, { basicBlockStarts, targetPc});
      // invalid branch target: panic
      return { exitReason: ExitReasonType.Panic, pc: currentPc };
    } else {
      console.log(`Branching to ${targetPc} is valid.`);
      // Valid branch target: jump
      return { exitReason: ExitReasonType.Continue, pc: targetPc };
    }
  }