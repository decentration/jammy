import { WHO, HUH, OK } from "../consts";
import { HostCallHandler } from "../types";

type InnerMem = {
  vPages: Map<number, Uint8Array>; // values...  pageNo -> 4096B
  aPages: Map<number, number>;     // access... 0=empty, 1=R, 2=W
};

const PAGE_SIZE = 1 << 12;       // 4096 bytes
const MIN_PAGE  = 16;            // p >= 16
const MAX_PAGES = 1 << 20;       // 2^32 / 2^12 = 1,048,576

function ensureInnerMem(mem: any): InnerMem {
  if (mem && mem.vPages && mem.aPages) return mem as InnerMem;
  else return { vPages: new Map(), aPages: new Map() };
}

function getAccess(mem: InnerMem, page: number): number {
  return mem.aPages.get(page) ?? 0; // empty by default
}

function setAccess(mem: InnerMem, page: number, mode: number) {
  if (mode === 0) mem.aPages.delete(page); 
  else mem.aPages.set(page, mode); // mem is (u)
}

function zeroPage(mem: InnerMem, page: number) {
  const buf = mem.vPages.get(page);
  if (buf) {
    buf.fill(0);
  } else {
    mem.vPages.set(page, new Uint8Array(PAGE_SIZE)); // implicitly zeroed
  }
}

// ΩZ – pages (selector 11)
// g = 10 (charged by our dispatcher globally)
export const pagesHandler: HostCallHandler = (s, _id, env) => {
  const machineIdx = Number(s.registers[7]);   // (n)
  const startPage = Number(s.registers[8]);    // (p)
  const count = Number(s.registers[9]);        // (c))
  const mode = Number(s.registers[10]);        // (r) mode: 0..4

  const regs = s.registers.slice();

  // check m[n] exists
  const entry = env.machineTable.get(machineIdx);
  if (!entry) {
    regs[7] = WHO;
    return { state: { ...s, registers: regs }, ok: true };
  }

  // basic param checks
  if (mode > 4 || startPage < MIN_PAGE || startPage + count >= MAX_PAGES) {
    regs[7] = HUH;
    return { state: { ...s, registers: regs }, ok: true };
  }

  const memory = ensureInnerMem(entry.u);

  // if r>2 (3 or 4), forbid promoting empty pages (must already be allocated)
  if (mode > 2) {
    for (let page = startPage; page < startPage + count; page++) {
      if (getAccess(memory, page) === 0) {
        regs[7] = HUH;
        return { state: { ...s, registers: regs }, ok: true };
      }
    }
  }

  // r<3 => zero the bytes
  if (mode < 3) {
    for (let page = startPage; page < startPage + count; page++) zeroPage(memory, page);
  }

  // set access mode for the range
  // 0 => empty, (1|3) => R(1), (2|4) => W(2)
  const accessMode = (mode === 0) ? 0 : ((mode === 1 || mode === 3) ? 1 : 2);
  for (let page = startPage; page < startPage + count; page++) setAccess(memory, page, accessMode);

  // write back
  entry.u = memory;
  env.machineTable.set(machineIdx, entry);

  regs[7] = OK;
  return { state: { ...s, registers: regs }, ok: true };
};
