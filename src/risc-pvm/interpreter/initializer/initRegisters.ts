import { ZZ, ZI } from "../host/consts";

// A.43 registers
export const initRegisters = (argsLength: number): bigint[] => {
  const u32 = BigInt(2 ** 32);
  const regs: bigint[] = Array(13).fill(0n);
  regs[0] = u32 - BigInt(1 << 16);        // 2^32 − 2^16
  regs[1] = u32 - BigInt(2 * ZZ + ZI);    // 2^32 − 2·ZZ − ZI
  regs[7] = u32 - BigInt(ZZ + ZI);        // 2^32 − ZZ − ZI
  regs[8] = BigInt(argsLength);           // |a|

  return regs
}