import { ZZ, ZP, PAGE_SIZE } from "../host/consts";
import { P_vm, Z_vm } from "./helpers";
import { LayoutMemory, ProgramContainerParts } from "./types";


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

  const page = (addr: number) => (addr / PAGE_SIZE) | 0;
  const mapPlan = [
    { from: page(roStart), to: page(roPadEnd), read: true,  write: false },
    { from: page(rwStart), to: page(reserveEnd), read: true,  write: true  },
  ];

  return {
    memInit,
    mapPlan,
    heapStart,
    heapEnd,
  }
}