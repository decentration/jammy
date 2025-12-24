import { GAS_IO_ACCESS, GAS_MEM_BASE, GAS_MEM_BYTE, GAS_PER_INSTRUCTION } from "../consts";
import { PAGE_SIZE } from "../host/consts";
import { checkAccess } from "../memory";
import { InterpreterState, ExitReasonType } from "../types";


export function chargeGas(
  state: InterpreterState,
  cost: bigint,
): InterpreterState {
  const remaining = state.gas - cost;
  if (remaining <= 0n) {
    return {
      ...state,
      gas: 0n,
      exit: { type: ExitReasonType.OutOfGas },
    };
  }
  return {
    ...state,
    gas: remaining,
  };
}

export function chargeInstruction(state: InterpreterState): InterpreterState {
  return chargeGas(state, GAS_PER_INSTRUCTION);
}

export function chargeMem(state: InterpreterState, len: number): InterpreterState {
  const cost = GAS_MEM_BASE + GAS_MEM_BYTE * BigInt(len);
  return chargeGas(state, cost);
}

const IO_BASE  = 0xfe_fe_00_00 >>> 0;
const IO_LIMIT = (IO_BASE + 0x0002_0000) >>> 0; // FEFE + FEFF 128 KiB

export function isIoAddr(addr: number): boolean {
  const a = addr >>> 0;
  return a >= IO_BASE && a < IO_LIMIT;
}

export function chargeIo(state: InterpreterState, len: number): InterpreterState {
  return chargeGas(state, GAS_IO_ACCESS + GAS_MEM_BYTE * BigInt(len));
}


function panicLowMemory(s: InterpreterState): InterpreterState {
  return { ...s, exit: { type: ExitReasonType.Panic, detail: "low-mem" } };
}

function inBand(base: number | undefined, size: number, addr: number, len: number) {
  if (base === undefined) return false;
  const end = base + size;
  return addr >= base && (addr + len) <= end;
}

export function readBytes(s: InterpreterState, addr: number, len: number) {
  if (addr < PAGE_SIZE) return { state: panicLowMemory(s) };

  const ctx: any = s.context ?? {};
  const { argsBand, stackBand, argsBase, stackStart, stackTop } = ctx;

  // ROUTE FIRST
  if (argsBand && inBand(argsBase, argsBand.length, addr, len)) {
    const off = addr - argsBase;
    return { bytes: argsBand.subarray(off, off + len), state: s };
  }

  if (stackBand && stackStart !== undefined && stackTop !== undefined) {
    const stackSize = stackTop - stackStart;
    if (inBand(stackStart, stackSize, addr, len)) {
      const off = addr - stackStart;
      if (off < 0 || (off + len) > stackBand.length) {
        return { state: triggerFaultWithDetail(s, addr >>> 16) };
      }
      return { bytes: stackBand.subarray(off, off + len), state: s };
    }
  }

  // then normal RAM checks
  const badPage = checkAccess(s.context!.pageTable, addr, len, false);
  if (badPage !== undefined) return { state: triggerFaultWithDetail(s, badPage) };
  if (addr < 0 || (addr + len) > s.memory.length) {
    return { state: triggerFaultWithDetail(s, addr >>> 16) };
  }
  return { bytes: s.memory.subarray(addr, addr + len), state: s };
}

export function writeBytes(s: InterpreterState, addr: number, buf: Uint8Array): InterpreterState {
  if (addr < PAGE_SIZE) return panicLowMemory(s);

  const ctx: any = s.context ?? {};
  const { argsBand, stackBand, argsBase, stackStart, stackTop } = ctx;

  // ROUTE FIRST
  if (argsBand && inBand(argsBase, argsBand.length, addr, buf.length)) {
    // args are read-only => fault on write
    return triggerFaultWithDetail(s, addr >>> 16);
  }
  
  if (stackBand && stackStart !== undefined && stackTop !== undefined) {
    const stackSize = stackTop - stackStart;
    if (inBand(stackStart, stackSize, addr, buf.length)) {
      const off = addr - stackStart;
      if (off < 0 || (off + buf.length) > stackBand.length) {
        return triggerFaultWithDetail(s, addr >>> 16);
      }
      stackBand.set(buf, off);
      return s;
    }
  }

  // then normal RAM checks
  const badPage = checkAccess(s.context!.pageTable, addr, buf.length, true);
  if (badPage !== undefined) return triggerFaultWithDetail(s, badPage);
  if (addr < 0 || (addr + buf.length) > s.memory.length) {
    return triggerFaultWithDetail(s, addr >>> 16);
  }
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

// decode little-endian bytes -> bigint
export const fromLE = (u8: ArrayLike<number>, offset = 0, bytes: 1 | 2 | 4 | 8): bigint => {
  let v = 0n;
  for (let i = 0; i < bytes; i++) {
    v |= BigInt(u8[offset + i]) << BigInt(8 * i);
  }
  return BigInt.asUintN(bytes * 8, v);
};


export function panic(state: InterpreterState) {
  return { ...state, exit: { type: ExitReasonType.Panic } };
}



