import { checkAccess } from "../memory";
import { InterpreterState, ExitReasonType } from "../types";

export function readBytes(
  s: InterpreterState,
  addr: number,
  len: number
): { bytes?: Uint8Array; state: InterpreterState } {
  const badPage = checkAccess(s.context!.pageTable, addr, len, false);
  if (badPage !== undefined) return { state: triggerFaultWithDetail(s, badPage) };
  return { bytes: s.memory.subarray(addr, addr + len), state: s };
}

export function writeBytes(
  s: InterpreterState, 
  addr: number, 
  buf: Uint8Array): InterpreterState {

  const badPage = checkAccess(s.context!.pageTable, addr, buf.length, true);
  if (badPage !== undefined)
    return triggerFaultWithDetail(s, badPage);
  s.memory.set(buf, addr);
  return s;
}

function triggerFaultWithDetail(s: InterpreterState, page: number): InterpreterState {

  const res = {
    ...s,
    exit: { type: ExitReasonType.PageFault, detail: page },
  };

  console.log("r0 =", s.registers[0].toString(16), "r1 =", s.registers[1].toString(16));

  return res;
}