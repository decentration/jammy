import { withinBudget } from "./helpers";
import { initRegisters } from "./initRegisters";
import { layoutMemory } from "./layoutMemory";
import { parseProgramContainer } from "./parseProgamContainer";
import { StandardInitResult } from "./types";

// A.37
export const initializeStandardProgram = (
  container: Uint8Array,
  args: Uint8Array,
  memSize: number
): StandardInitResult => {
  const parts = parseProgramContainer(container);
  if (!parts) throw new Error("Y(p,a): not a standard program container");
  if (!withinBudget(parts)) throw new Error("Y(p,a): violates A.41 memory budget");

  const mem = layoutMemory(parts, memSize) // A.42
  const regs = initRegisters(args.length) // A.43

  const { code, reservePages, stackSizeBytes, readOnly, readWrite } = parts;
  return {
    code, // inner blob
    registers: regs,
    ...mem,
    reservePages,
    stackSizeBytes,
    readOnlyLen: readOnly.length,
    readWriteLen: readWrite.length,
  };
}
