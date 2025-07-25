import { checkAccess } from "../memory";
import { InterpreterState, ExitReasonType, PAGE_SIZE } from "../types";

function panicLowMemory(s: InterpreterState): InterpreterState {
  return { ...s, exit: { type: ExitReasonType.Panic, detail: "low-mem" } };
}

export function readBytes(
  s: InterpreterState,
  addr: number,
  len: number
): { bytes?: Uint8Array; state: InterpreterState } {

  if (addr < PAGE_SIZE) return { state: panicLowMemory(s) };
  
  const badPage = checkAccess(s.context!.pageTable, addr, len, false);
  if (badPage !== undefined) return { state: triggerFaultWithDetail(s, badPage) };
  return { bytes: s.memory.subarray(addr, addr + len), state: s };
}

export function writeBytes(
  s: InterpreterState, 
  addr: number, 
  buf: Uint8Array): InterpreterState {

  if (addr < PAGE_SIZE) return panicLowMemory(s);
  console.log("writeBytes", { addr, buf, s });

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


export const toLE = (value: bigint, bytes: 1 | 2 | 4 | 8): Uint8Array => {
  const out = new Uint8Array(bytes);
  for (let i = 0; i < bytes; i++)
    out[i] = Number((value >> BigInt(8 * i)) & 0xFFn);
  return out;
};

export function panic(state: InterpreterState) {
  return { ...state, exit: { type: ExitReasonType.Panic } };
}