import { WHO, HUH, OK, MIN_PAGE, MAX_PAGES } from "../../consts";
import { ensureInnerMem, getAccess, setAccess, zeroPage } from "../../innerMem/helpers";
import { HostCallHandler } from "../../types";

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
      if (!memory.aPages.has(page) || getAccess(memory, page) === 0) {
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
  env.machineTable.set(machineIdx, { ...entry, u: memory });

  regs[7] = OK;
  return { state: { ...s, registers: regs }, ok: true };
};
