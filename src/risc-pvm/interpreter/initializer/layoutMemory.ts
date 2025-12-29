import { ZZ, ZP } from "../host/consts";
import { P_vm, Z_vm } from "./helpers";
import { LayoutMemory, ProgramContainerParts } from "./types";

// Page calculation uses 64KB pages (ZZ) to match checkAccess in memory.ts
const PAGE_64K = ZZ; // 65536

export function layoutMemory(parts: ProgramContainerParts, memSize: number): LayoutMemory {
  const { readOnly, readWrite, reservePages } = parts;

  // A.42 layout
  const roStart = ZZ;
  const roEnd = roStart + readOnly.length;
  const roPadEnd = roStart + P_vm(readOnly.length);

  const rwStart = 2 * ZZ + Z_vm(readOnly.length);
  const rwEnd = rwStart + readWrite.length;
  const rwPadEnd = rwStart + P_vm(readWrite.length);

  const reserveBytes = reservePages * ZP;
  const reserveEnd = rwPadEnd + P_vm(reserveBytes);

  const heapStart = rwStart;
  const heapEnd = reserveEnd;

  const memInit = new Uint8Array(memSize);
  if (roEnd <= memSize) memInit.set(readOnly, roStart);
  if (rwEnd <= memSize) memInit.set(readWrite, rwStart);

  // Use 64KB pages to match memory.ts checkAccess
  const page = (addr: number) => (addr / PAGE_64K) | 0;
  const mapPlan = [
    { from: page(roStart), to: page(roPadEnd) + 1, read: true,  write: false },
    { from: page(rwStart), to: page(reserveEnd) + 1, read: true,  write: true  },
  ];

  return {
    memInit,
    mapPlan,
    heapStart,
    heapEnd,
  }
}