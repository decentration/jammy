/**
 * (A.3) Calculates the number of bytes to skip from current instruction to next instruction opcode,
 * minus one, capped at 24.
 *
 * @param pc - Current instruction's opcode index
 * @param opcodeBits - Boolean array where each entry indicates whether the byte is an opcode (`true`) or operand (`false`).
 */
export function skip(pc: number, opcodeBits: boolean[]): number {
  const paddedBits = opcodeBits.concat(new Array(24).fill(true)); // Padding with 1s ensures we always find an opcode within 24 steps

  for (let j = 0; j < 24; j++) {
    
    if (paddedBits[pc + 1 + j]) {
      console.log(`Skipping ${j} bytes from pc=${pc} to find next opcode.`, j);
      return j; // Found next opcode, return distance
    }
  }
  return 24; // cap it at 24 
}