import { isInArgsBand, isInStackBand, PAGE_SIZE, ZZ } from "./host/consts";
import { HostEnvInterface } from "./host/hostEnvInterface";
import { PageTable, PageMeta } from "./types";

// We map the FEFE/FEFF mailbox window (128 KiB) into env.ioBuffer.
export const IO_BASE = 0xFEFE0000 >>> 0;
export const IO_SIZE = 0x00020000 >>> 0; // covers FEFE and FEFF 64 KiB pages
export const IO_LIMIT = (IO_BASE + IO_SIZE) >>> 0;
const PAGE_FAULT_CODE = 0xfe_fe; // 65278



// build page-table with N pages default-inaccessible
export function createPageTable(numPages: number): PageTable {
  return Array.from({ length: numPages }, () => ({ read: false, write: false }));
}

// mark pages (startPage, endPage) with R/W flags
export function mapPages(
  pageTable: PageTable,
  startPage: number,
  endPage: number,
  perms: PageMeta
) {
  for (let p = startPage; p < endPage; p++) {
    // ensure page exists in table
    pageTable[p] = { ...perms };
  }
}

// check read/write of (addr, addr + len) – returns lowest bad page or undefined
export function checkAccess(
  pageTable: PageTable,
  addr: number,
  len: number,
  isWrite: boolean
): number | undefined {

  // Normalize to uint32
  addr = addr >>> 0;
  len = len >>> 0;
  const end = (addr + len - 1) >>> 0; // inclusive end

  // ---- IO WINDOW FAST PATH ----
  // Any access fully inside [IO_BASE, IO_LIMIT) is allowed.
  if (addr >= IO_BASE && end < IO_LIMIT) {
    console.log("[checkAccess] IO fast-path", { addr: addr.toString(16), len, end: end.toString(16) });

    return undefined;
  }

  // ---- SPEC BANDS FAST-PATH ----
  // Stack band: allow both reads and writes
  if (isInStackBand(addr, len)) {
    return undefined;
  }
  // Args band: allow reads, deny writes
  if (isInArgsBand(addr, len)) {
    return isWrite ? ((addr >>> 16) as number) : undefined;
  }

  const firstPage = addr >>> 16;
  const lastPage = end >>> 16;

  for (let p = firstPage; p <= lastPage; p++) {
    const meta = pageTable[p] ?? { read: false, write: false };
    if (!meta.read || (isWrite && !meta.write)) {
      return p;
    }
  }

  return undefined;
}





// We raise a page-fault with the 16-bit page id (detail = addr >> 16).
const raisePageFault = (addr: number): never => {
  const page = (addr >>> 16) & 0xffff;
  const err: any = new Error(`PageFault detail=${page}`);
  err.code = "PAGE_FAULT";
  err.detail = page;
  throw err;
};




// Keep this aligned with the rest of the VM helpers.
export interface Memory {
  bytes: Uint8Array;

  // Raw view into the backing heap.
  viewFor(addr: number, len: number): { buf: Uint8Array; off: number };

  // Bulk ops
  load(addr: number, len: number): Uint8Array;
  store(addr: number, data: Uint8Array): void;
  memset(addr: number, value: number, length: number): void;
  memcpy(dst: number, src: number, length: number): void;

  // Scalar ops
  getU8(addr: number): number;
  setU8(addr: number, v: number): void;
  getU16(addr: number): number;
  setU16(addr: number, v: number): void;
  getU32(addr: number): number;
  setU32(addr: number, v: number): void;
  getU64(addr: number): bigint;
  setU64(addr: number, v: bigint): void;
}

const inIoWindow = (addr: number, len: number): boolean => {
  addr = addr >>> 0;
  len = len >>> 0;
  if (len === 0) return false;

  const end = (addr + len) >>> 0;
  if (end < addr) return false; // wrap
  return addr >= IO_BASE && end <= IO_LIMIT;
};




export function makeMemory(heap: Uint8Array, env: HostEnvInterface): Memory {
  const heapLen = heap.length >>> 0;

  const pageFault = (addr: number, len: number): never => {
    try { (env as any)?.onPageFault?.(addr >>> 0, len >>> 0, PAGE_FAULT_CODE); } catch { }
    const e = new Error(`PageFault @0x${(addr >>> 0).toString(16)} len=${len}`);
    (e as any).exit = {
      type: "PageFault",
      detail: PAGE_FAULT_CODE,
      addr: addr >>> 0,
      len,
    };
    throw e;
  };

  const viewFor = (addr: number, len: number): { buf: Uint8Array; off: number } => {
    addr = addr >>> 0;
    len = len >>> 0;

    const end = (addr + len) >>> 0;

    // --- 1) IO WINDOW: FEFE/FEFF mailbox ---
    if (addr >= IO_BASE && end <= IO_LIMIT) {
      // Ensure we have a buffer; attach it back to env so host handlers see the same one.
      let buf = env.ioBuffer;
      if (!buf || buf.length !== IO_SIZE) {
        buf = new Uint8Array(IO_SIZE);
        (env as any).ioBuffer = buf;
      }

      const off = (addr - IO_BASE) >>> 0;
      return { buf, off };
    }

    // --- 2) Normal heap region ---
    const wrapped = end < addr;
    const oob = end > heapLen;
    if (wrapped || oob) {
      return pageFault(addr, len); // throws
    }

    return { buf: heap, off: addr };
  };

  const load = (addr: number, len: number): Uint8Array => {
    const { buf, off } = viewFor(addr, len);
    return buf.slice(off, off + (len >>> 0));
  };

  const store = (addr: number, data: Uint8Array): void => {
    const len = data.length >>> 0;
    const { buf, off } = viewFor(addr, len);
    buf.set(data, off);
  };

  const memset = (addr: number, value: number, length: number): void => {
    const len = length >>> 0;
    const { buf, off } = viewFor(addr, len);
    const v = value & 0xff;
    for (let i = 0; i < len; i++) buf[off + i] = v;
  };

  const memcpy = (dst: number, src: number, length: number): void => {
    const len = length >>> 0;
    const srcView = viewFor(src, len);
    const dstView = viewFor(dst, len);

    if (srcView.buf === dstView.buf) {
      const tmp = srcView.buf.slice(srcView.off, srcView.off + len);
      dstView.buf.set(tmp, dstView.off);
    } else {
      const tmp = srcView.buf.subarray(srcView.off, srcView.off + len);
      dstView.buf.set(tmp, dstView.off);
    }
  };

  const getU8 = (addr: number): number => load(addr, 1)[0]!;
  const setU8 = (addr: number, v: number): void =>
    store(addr, Uint8Array.of(v & 0xff));

  const getU16 = (addr: number): number => {
    const b = load(addr, 2);
    return (b[0]! | (b[1]! << 8)) >>> 0;
  };
  const setU16 = (addr: number, v: number): void => {
    const x = v >>> 0;
    store(addr, Uint8Array.of(x & 0xff, (x >>> 8) & 0xff));
  };

  const getU32 = (addr: number): number => {
    const b = load(addr, 4);
    return (
      (b[0]!) |
      (b[1]! << 8) |
      (b[2]! << 16) |
      (b[3]! << 24)
    ) >>> 0;
  };
  const setU32 = (addr: number, v: number): void => {
    const x = v >>> 0;
    store(
      addr,
      Uint8Array.of(
        x & 0xff,
        (x >>> 8) & 0xff,
        (x >>> 16) & 0xff,
        (x >>> 24) & 0xff,
      ),
    );
  };

  const getU64 = (addr: number): bigint => {
    const b = load(addr, 8);
    const lo =
      (b[0]!) |
      (b[1]! << 8) |
      (b[2]! << 16) |
      (b[3]! << 24);
    const hi =
      (b[4]!) |
      (b[5]! << 8) |
      (b[6]! << 16) |
      (b[7]! << 24);
    return (BigInt(hi >>> 0) << 32n) | BigInt(lo >>> 0);
  };

  const setU64 = (addr: number, v: bigint): void => {
    const x = BigInt.asUintN(64, v);
    const lo = Number(x & 0xffff_ffffn) >>> 0;
    const hi = Number((x >> 32n) & 0xffff_ffffn) >>> 0;
    store(
      addr,
      Uint8Array.of(
        lo & 0xff,
        (lo >>> 8) & 0xff,
        (lo >>> 16) & 0xff,
        (lo >>> 24) & 0xff,
        hi & 0xff,
        (hi >>> 8) & 0xff,
        (hi >>> 16) & 0xff,
        (hi >>> 24) & 0xff,
      ),
    );
  };

  return {
    bytes: heap,
    viewFor,
    load,
    store,
    memset,
    memcpy,
    getU8,
    setU8,
    getU16,
    setU16,
    getU32,
    setU32,
    getU64,
    setU64,
  };
}

