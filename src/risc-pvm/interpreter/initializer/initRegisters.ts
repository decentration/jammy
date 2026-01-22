import { ZZ, ZI } from "../host/consts";

// Entry point selectors for service invocation
// These match the JAM SDK runtime expectations for service function dispatch
export const ENTRY_REFINE = 5n;
export const ENTRY_ACCUMULATE = 4n;    // CONFORMANCE FIX: Changed from 3 to 4 per TypeBerry
export const ENTRY_ON_TRANSFER = 15n;

// A.43 registers
// RISC-V convention typically passes first args in a0-a7, which may map to r4-r11 in PVM
export type SdkArgs = { slot?: number; serviceId?: number; itemCount?: number };

export const initRegisters = (argsLength: number, entryPoint?: bigint, sdkArgs?: SdkArgs): bigint[] => {
  const u32 = BigInt(2 ** 32);
  const regs: bigint[] = Array(13).fill(0n);

  // A.43 spec registers
  regs[0] = u32 - BigInt(1 << 16);           // 2^32 − 2^16 (stack top / return address)
  regs[1] = u32 - BigInt(2 * ZZ + ZI);       // 2^32 − 2·ZZ − ZI (args base / stack pointer)
  regs[7] = u32 - BigInt(ZZ + ZI);           // 2^32 − ZZ − ZI (args end / heap pointer)

  regs[8] = entryPoint ?? ENTRY_ACCUMULATE;

  if (process.env.JAM_DEBUG_REGS === "1" && sdkArgs) {
    console.log(`[initRegisters] SDK args ignored per A.43: slot=${sdkArgs.slot} sid=${sdkArgs.serviceId} count=${sdkArgs.itemCount}`);
  }

  if (process.env.JAM_DEBUG_REGS === "1") {
    console.log(`[initRegisters] r4=0x${regs[4].toString(16)} r5=0x${regs[5].toString(16)} r6=0x${regs[6].toString(16)} r7=0x${regs[7].toString(16)} r8=${regs[8]}`);
  }

  return regs
}