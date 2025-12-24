import { PAGE_SIZE, ZI, ZP, ZZ } from "../host/consts";
import { ProgramContainerParts } from "./types";

// ceil to multiples (spec functions P and Z) — adapted to the PVM's PAGE_SIZE where needed.
const ceilTo = (x: number, q: number) => Math.ceil(x / q) * q;
export const P_vm = (x: number) => ceilTo(x, PAGE_SIZE); // page padding in VM
export const Z_vm = (x: number) => ceilTo(x, ZZ);        // major-zone rounding (A.40 uses ZZ)


export const withinBudget = (parts: ProgramContainerParts) => {
  const { readOnly, readWrite, reservePages, stackSizeBytes, code } = parts;

  // A.41 budget sanity (we don’t allocate 2^32, we just bound-check)
  const specBudget = 
    5 * ZZ 
    + Z_vm(readOnly.length)
    + Z_vm(readWrite.length + reservePages * ZP)
    + Z_vm(stackSizeBytes)
    + ZI;

  return specBudget
}

export const U32 = 2 ** 32;
export const P = (x: number) => (x + 0xFFFF) & ~0xFFFF; // page-align to 64KiB (ZZ)
export const Z = (x: number) => P(x) >>> 16;            // pages at ZZ granularity

export const toU32 = (n: number | bigint) => Number((BigInt(n) & 0xFFFF_FFFFn));



  


