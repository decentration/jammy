import { ZZ, ZP } from "../host/consts";
import { P_vm, Z_vm } from "./helpers";
import { LayoutMemory, ProgramContainerParts } from "./types";

// Page calculation uses 4KiB pages (ZP) per GP 4.24-4.25
const PAGE_4K = ZP; // 4096

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

  const heapStart = rwPadEnd + PAGE_4K;

  // CRITICAL: heapPointer per GP A.42:
  // Initial heap pointer = rwStart + P(rwLen) + reservePages * ZP
  // sbrk(0) returns this value; if wrong, branch conditions diverge.
  // For test vector with rwLen=20, reservePages=2:
  // heapPointer = 0x30000 + 0x1000 + 2*0x1000 = 0x33000
  const heapPointer = rwStart + P_vm(readWrite.length) + reservePages * ZP;

  const heapEnd = memSize;  // Heap grows from heapPointer to end of memory

  if (process.env.JAM_DEBUG_LAYOUT === "1") {
    console.log(`[layoutMemory] ZZ=0x${ZZ.toString(16)} roStart=0x${roStart.toString(16)} roEnd=0x${roEnd.toString(16)} roPadEnd=0x${roPadEnd.toString(16)}`);
    console.log(`[layoutMemory] rwStart=0x${rwStart.toString(16)} rwEnd=0x${rwEnd.toString(16)} rwPadEnd=0x${rwPadEnd.toString(16)}`);
    console.log(`[layoutMemory] heapStart=0x${heapStart.toString(16)} heapEnd=0x${heapEnd.toString(16)}`);
  }

  const memInit = new Uint8Array(memSize);
  if (roEnd <= memSize) memInit.set(readOnly, roStart);
  if (rwEnd <= memSize) memInit.set(readWrite, rwStart);

  // Debug: check initial value at mutex address 0x32760
  if (process.env.JAM_DEBUG_MUTEX === "1") {
    const mutexAddr = 0x32760;
    const val = memInit[mutexAddr];
    console.log(`[layoutMemory:mutex] addr=0x${mutexAddr.toString(16)} initialValue=${val} rwStart=0x${rwStart.toString(16)} rwEnd=0x${rwEnd.toString(16)}`);
    if (mutexAddr >= rwStart && mutexAddr < rwEnd) {
      const offsetInRW = mutexAddr - rwStart;
      console.log(`[layoutMemory:mutex] offsetInRW=0x${offsetInRW.toString(16)} rwBlob[offset]=${readWrite[offsetInRW]}`);
    }
  }

  // Use 4KiB pages (ZP) per GP 4.24-4.25
  const page = (addr: number) => (addr / PAGE_4K) | 0;
  const mapPlan = [
    { from: page(roStart), to: page(roPadEnd) + 1, read: true, write: false },
    { from: page(rwStart), to: page(reserveEnd) + 1, read: true, write: true },
  ];

  return {
    memInit,
    mapPlan,
    heapStart,
    heapPointer,
    heapEnd,
  }
}