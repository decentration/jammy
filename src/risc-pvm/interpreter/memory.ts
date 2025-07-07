import { PageTable, PageMeta, PAGE_SIZE } from "./types";

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
  if (addr < PAGE_SIZE) return 0; // spec: < 2^16 panic-zone
  const firstPage = addr >>> 16;
  const lastPage  = (addr + len - 1) >>> 16;

  for (let p = firstPage; p <= lastPage; p++) {
    const meta = pageTable[p] ?? { read: false, write: false };
    if (!meta.read || (isWrite && !meta.write)) return p;
  }
}
