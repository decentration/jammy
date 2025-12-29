import { ZZ, ZI } from "../host/consts";

// Entry point selectors for service invocation
export const ENTRY_REFINE = 5n;
export const ENTRY_ACCUMULATE = 12n;
export const ENTRY_ON_TRANSFER = 15n;

// A.43 registers
// For service invocation, r0 can be set to an entry point selector (5=refine, 12=accumulate, 15=on_transfer)
export const initRegisters = (argsLength: number, entryPoint?: bigint): bigint[] => {
  const u32 = BigInt(2 ** 32);
  const regs: bigint[] = Array(13).fill(0n);
  // If entryPoint is provided, use it; otherwise use heap boundary (A.43 default)
  regs[0] = entryPoint ?? (u32 - BigInt(1 << 16));  // entry point selector OR 2^32 − 2^16
  regs[1] = u32 - BigInt(2 * ZZ + ZI);    // 2^32 − 2·ZZ − ZI
  regs[7] = u32 - BigInt(ZZ + ZI);        // 2^32 − ZZ − ZI
  regs[8] = BigInt(argsLength);           // |a|

  return regs
}