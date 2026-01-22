import { GAS_IO_ACCESS, GAS_MEM_BASE, GAS_MEM_BYTE, GAS_PER_INSTRUCTION } from "../consts";
import { ZZ } from "../host/consts";
import { checkAccess } from "../memory";
import { InterpreterState, ExitReasonType } from "../types";

// log first write that touches adress 0x32760 and is released with 0x00
let _watch32760First = true;
let _watch32760ReleaseFirst = true;

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

const IO_BASE = 0xfe_fe_00_00 >>> 0;
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
  const res = addr >= base && (addr + len) <= end;
  return res;
}

function readBytesImpl(s: InterpreterState, addr: number, len: number, allowLowMem: boolean) {
  const DBG = process.env.JAM_DEBUG_MEM === "1" || process.env.JAM_DEBUG_STEP === "1";
  if (DBG) console.log("[readBytes] addr:", addr.toString(16), "len:", len);
  if (!allowLowMem && addr < ZZ) {
    const regsSnap = s.registers.slice(0, 8).map((r, i) => `r${i}=0x${r.toString(16)}`).join(" ");
    if (DBG) console.log(`[readBytes:lowmem] pc=${s.pc} addr=0x${addr.toString(16)} len=${len} ${regsSnap}`);
    return { state: panicLowMemory(s) };
  }

  // A.42: Addresses 0 to ZZ-1 map to the code segment (read-only)
  if (addr < ZZ && (addr + len) <= ZZ) {
    // Route to code array (stored in s.code)
    const code = s.code;
    if (addr >= 0 && (addr + len) <= code.length) {
      const bytes = code.subarray(addr, addr + len);
      if (DBG) console.log(`[readBytes:code] addr=0x${addr.toString(16)} len=${len} bytes=[${Array.from(bytes).slice(0, 8).join(',')}]`);
      return { bytes, state: s };
    } else {
      // Out of bounds within code segment - return zeros (undefined code space)
      if (DBG) console.log(`[readBytes:code] addr=0x${addr.toString(16)} OOB, returning zeros`);
      return { bytes: new Uint8Array(len), state: s };
    }
  }

  const ctx: any = s.context ?? {};
  const { argsBand, stackBand, argsBase, stackStart, stackTop } = ctx;

  // ROUTE FIRST
  if (argsBand && inBand(argsBase, argsBand.length, addr, len)) {
    const off = addr - argsBase;
    const bytes = argsBand.subarray(off, off + len);
    if (DBG) console.log(`[readBytes:args] addr=0x${addr.toString(16)} off=${off} bytes=[${Array.from(bytes).join(',')}]`);
    return { bytes, state: s };
  }

  if (stackBand && stackStart !== undefined && stackTop !== undefined) {
    const stackSize = stackTop - stackStart;
    if (inBand(stackStart, stackSize, addr, len)) {
      const off = addr - stackStart;
      if (off < 0 || (off + len) > stackBand.length) {
        if (DBG) console.log(`[readBytes:stack] OOB check failed! off=${off} len=${len} limit=${stackBand.length}`);
        return { state: triggerFaultWithDetail(s, addr >>> 12) };
      }
      const bytes = stackBand.subarray(off, off + len);
      if (DBG) console.log(`[readBytes:stack] addr=0x${addr.toString(16)} bytes=[${Array.from(bytes).join(',')}] bandLen=${stackBand.length}`);
      return { bytes, state: s };
    }
  }

  // IO CHECK
  if (isIoAddr(addr)) {
    if (!ctx.ioBuffer) return { state: triggerFaultWithDetail(s, addr >>> 12) };
    const off = (addr - IO_BASE) >>> 0;
    if ((off + len) > ctx.ioBuffer.length) return { state: triggerFaultWithDetail(s, addr >>> 12) };
    return { bytes: ctx.ioBuffer.subarray(off, off + len), state: s };
  }

  // then normal RAM checks
  const badPage = checkAccess(s.context!.pageTable, addr, len, false);
  if (DBG) console.log(`[readBytes:ram] addr=0x${addr.toString(16)} len=${len} badPage=${badPage} memLen=${s.memory?.length}`);
  if (badPage !== undefined) return { state: triggerFaultWithDetail(s, badPage) };
  if (addr < 0 || (addr + len) > s.memory.length) {
    if (DBG) console.log(`[readBytes:ram] OOB: addr=${addr} + len=${len} > memLen=${s.memory.length}`);
    return { state: triggerFaultWithDetail(s, addr >>> 12) };
  }
  const bytes = s.memory.subarray(addr, addr + len);
  if (DBG) console.log(`[readBytes:ram] success at 0x${addr.toString(16)} data=[${Array.from(bytes).slice(0, 8).join(',')}]`);
  return { bytes, state: s };
}

// Host-call pointer reads should treat pointers < ZZ (64 KiB) as invalid (low-mem => Panic).
export function readBytes(s: InterpreterState, addr: number, len: number) {
  return readBytesImpl(s, addr, len, false);
}

// VM instruction loads may read low addresses
export function readBytesVm(s: InterpreterState, addr: number, len: number) {
  return readBytesImpl(s, addr, len, true);
}

function writeBytesImpl(s: InterpreterState, addr: number, buf: Uint8Array, allowLowMem: boolean): InterpreterState {
  const DBG = process.env.JAM_DEBUG_MEM === "1" || process.env.JAM_DEBUG_STEP === "1";
  if (!allowLowMem && addr < ZZ) return panicLowMemory(s);
  const watchLock =
    process.env.JAM_WATCH_32760 === "1" || process.env.JAM_TRACE_UNLOCK === "1";
  if (watchLock) {
    const watch = 0x32760;
    if (addr <= watch && (addr + buf.length) > watch) {
      const b0 = buf[watch - addr];
      if (_watch32760First) {
        _watch32760First = false;
        console.log(
          `[watch:0x32760:first] pc=${s.pc} writeBytes addr=0x${addr.toString(16)} len=${buf.length} byteAt=0x${(b0 ?? 0).toString(16).padStart(2, "0")}`,
        );
      }
      if (_watch32760ReleaseFirst && (b0 ?? 0) === 0) {
        _watch32760ReleaseFirst = false;
        console.log(
          `[watch:0x32760:release] pc=${s.pc} writeBytes addr=0x${addr.toString(16)} len=${buf.length} byteAt=0x00`,
        );
      }
    }
  }

  const ctx: any = s.context ?? {};
  const { argsBand, stackBand, argsBase, stackStart, stackTop } = ctx;

  // ROUTE FIRST
  if (argsBand && inBand(argsBase, argsBand.length, addr, buf.length)) {
    // FIX: Args zone should be writable for services that use it as scratch space
    // The service binary expects to write to the args zone during initialization
    const off = addr - argsBase;
    if (DBG) console.log(`[writeBytes:args] addr=0x${addr.toString(16)} off=${off} len=${buf.length}`);
    if (off < 0 || (off + buf.length) > argsBand.length) {
      return triggerFaultWithDetail(s, addr >>> 12);
    }
    argsBand.set(buf, off);
    return s;
  }

  if (stackBand && stackStart !== undefined && stackTop !== undefined) {
    const stackSize = stackTop - stackStart;
    if (inBand(stackStart, stackSize, addr, buf.length)) {
      const off = addr - stackStart;
      if (DBG) console.log(`[writeBytes:stack] addr=0x${addr.toString(16)} off=${off} len=${buf.length} bytes=[${Array.from(buf).slice(0, 8).join(',')}]`);
      if (off < 0 || (off + buf.length) > stackBand.length) {
        return triggerFaultWithDetail(s, addr >>> 12);
      }
      stackBand.set(buf, off);
      return s;
    }
  }

  // IO CHECK
  if (isIoAddr(addr)) {
    if (!ctx.ioBuffer) return triggerFaultWithDetail(s, addr >>> 12);
    const off = (addr - IO_BASE) >>> 0;
    if ((off + buf.length) > ctx.ioBuffer.length) return triggerFaultWithDetail(s, addr >>> 12);
    ctx.ioBuffer.set(buf, off);
    return s;
  }

  // then normal RAM checks
  const badPage = checkAccess(s.context!.pageTable, addr, buf.length, true);
  if (DBG) console.log(`[writeBytes:ram] addr=0x${addr.toString(16)} len=${buf.length} badPage=${badPage} memLen=${s.memory?.length}`);
  if (badPage !== undefined) return triggerFaultWithDetail(s, badPage);
  if (addr < 0 || (addr + buf.length) > s.memory.length) {
    if (DBG) console.log(`[writeBytes:ram] OOB: addr=${addr} + len=${buf.length} > memLen=${s.memory.length}`);
    return triggerFaultWithDetail(s, addr >>> 12);
  }
  s.memory.set(buf, addr);
  if (DBG) console.log(`[writeBytes:ram] success at 0x${addr.toString(16)}`);
  return s;
}

// Host-call pointer writes should treat pointers < 64 KiB as invalid (low-mem => Panic)
export function writeBytes(s: InterpreterState, addr: number, buf: Uint8Array): InterpreterState {
  return writeBytesImpl(s, addr, buf, false);
}

// VM instruction stores may write low addresses. page-table still enforces permissions (code pages are R/O).
export function writeBytesVm(s: InterpreterState, addr: number, buf: Uint8Array): InterpreterState {
  return writeBytesImpl(s, addr, buf, true);
}


function triggerFaultWithDetail(s: InterpreterState, page: number): InterpreterState {

  const res = {
    ...s,
    exit: { type: ExitReasonType.PageFault, detail: page },
  };

  if (process.env.JAM_DEBUG_MEM === "1" || process.env.JAM_DEBUG_STEP === "1") {
    console.log("r0 =", s.registers[0].toString(16), "r1 =", s.registers[1].toString(16));
  }

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



