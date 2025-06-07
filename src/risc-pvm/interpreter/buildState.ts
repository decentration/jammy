import { bitmaskToBoolean } from "./utils/bitmask";
import { ExitReasonType, InterpreterState } from "./types";

export function buildState(opts: {
  code: Uint8Array;
  bitmask: Uint8Array;
  initialGas?: number;
}): InterpreterState {
  const state = {
    code: opts.code,
    opcodeMaskBits: bitmaskToBoolean(opts.bitmask, opts.code.length),
    pc: 0,
    gas: opts.initialGas ?? 10_000,
    registers: Array(13).fill(0n),
    memory: new Uint8Array(2 ** 18),       // placeholder
    exit: { type: ExitReasonType.Running }, // initial state
  };

  console.log("Initial state built:", state);

  return state;
}