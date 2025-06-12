import { ExitReasonType, InterpreterState } from "../types";

// Convert numeric ExitReasonType to string label
export const exitReasonName = (t: ExitReasonType | undefined) =>
    t === undefined ? 
        "Continue" : 
        ExitReasonType[t] ?? `Unknown(${t})`;
  
  // Clone state but replace the numeric exit.type with its label.
  export const prettyState = (s: InterpreterState) => ({
    ...s,
    exit: s.exit ? 
    { ...s.exit, type: exitReasonName(s.exit.type) } : undefined,
  });