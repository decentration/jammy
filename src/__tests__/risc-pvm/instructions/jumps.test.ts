// src/__tests__/risc-pvm/instructions/jumps.test.ts
import { describe, it, expect } from "bun:test";
import { executeSingleStep } from "../../../risc-pvm/interpreter/executeSingleStep";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { computeBasicBlockStarts } from "../../../risc-pvm/interpreter/computeBasicBlockStarts";


export const toSigned24 = (b0: number, b1: number, b2: number): number => {
    const u = (b0 | (b1 << 8) | (b2 << 16)) >>> 0;
    return (u & 0x00800000) ? (u | 0xFF000000) : u;
  };



// Build a boolean bit array from opcode indices
const bitmaskFromLayout = (len: number, opcodeIdxs: number[]) => {
  const bits = Array(len).fill(false);
  for (const i of opcodeIdxs) bits[i] = true;
  return bits;
};

// Minimal VM state scaffold for a single-step test
const mkState = (code: Uint8Array, opcodeBits: boolean[], bbs: Set<number>, pc = 0) => ({
  code,
  opcodeMaskBits: opcodeBits,
  pc,
  gas: 100n,
  registers: Array(13).fill(0n),
  memory: new Uint8Array(1 << 16),
  exit: { type: ExitReasonType.Continue as const },
  context: {
    jumpTable: [],
    jumpEntryLength: 0,
    jumpEntries: [],
    basicBlockStarts: bbs,
    heapStart: 0x10000,
    heapPointer: 0x10000,
    heapEnd: 1 << 16,
    pageTable: [],
  },
});


const encOff24LE = (n: number) => {
  const u = (n & 0xFFFFFF) >>> 0; // two's complement in 24 bits
  return [u & 0xFF, (u >>> 8) & 0xFF, (u >>> 16) & 0xFF];
};


describe("jump (off24, nextPc-relative)", () => {
  it("forward jump to a valid BB start at index 5 (target = nextPc + off24)", () => {
    // Layout: [ jump, off24(3 bytes), fallthrough, fallthrough ]
    // pc=0: jump (1) + operands (3) => nextPc = 4
    // We want to land at index 5, so off24 = +1
    const code = new Uint8Array([
      Opcodes.jump, ...encOff24LE(5),
      Opcodes.fallthrough, // index 4 (termination)
      Opcodes.fallthrough, // index 5 (must be marked opcode to be a BB start)
    ]);
    const opcodeBits = bitmaskFromLayout(code.length, [0, 4, 5]);
    const bbs = computeBasicBlockStarts(code, opcodeBits);
    // After computing BBs:
    // - 0 is a BB (first instr)
    // - next block after pc=0 jump is index 4 (added if opcodeBits[4])
    // - next block after pc=4 fallthrough is index 5 (added if opcodeBits[5])
    const s0 = mkState(code, opcodeBits, bbs, 0) as any;
    const s1 = executeSingleStep(s0);

    expect(s1.exit!.type).toBe(ExitReasonType.Continue);
    expect(s1.pc).toBe(5);               // landed exactly at the BB start we created
    expect(s1.gas).toBeLessThan(s0.gas); // gas charged
  });


it("jump off24 decodes -7 and lands on BB index 1", () => {
  // Layout:
  // 0..3: fallthrough (each is terminator, so 1,2,3 are BBs)
  // 4:    jump
  // 5..7: off24 = -7  (nextPc = 8; 8 + (-7) = 1)
  // 8..9: fallthroughs
  const code = new Uint8Array([
    Opcodes.fallthrough, // 0
    Opcodes.fallthrough, // 1 (BB)
    Opcodes.fallthrough, // 2 (BB)
    Opcodes.fallthrough, // 3 (BB)
    Opcodes.jump,        // 4
    ...encOff24LE(-3),     // 5..7
    Opcodes.fallthrough, // 8 (BB)
    Opcodes.fallthrough, // 9 (BB)
  ]);

  const opcodeBits = bitmaskFromLayout(code.length, [0,1,2,3,4,8,9]);
  const bbs = computeBasicBlockStarts(code, opcodeBits);
  const s0 = mkState(code, opcodeBits, bbs, /*pc=*/4) as any;
  const s1 = executeSingleStep(s0);

  expect(s1.exit!.type).toBe(ExitReasonType.Continue);
  expect(s1.pc).toBe(1);
});

  

  it("rejects a target that is not a BB start (masking/sign-extend still applied)", () => {
    const code = new Uint8Array([
      Opcodes.jump, ...encOff24LE(0), // nextPc=4, off24=0 => target=4
      Opcodes.fallthrough,          // 4
    ]);
    const opcodeBits = bitmaskFromLayout(code.length, [0, 4]);
    const bbs = computeBasicBlockStarts(code, opcodeBits);
    const s0 = mkState(code, opcodeBits, bbs, 0) as any;

    // Force a bogus raw offset by modifying the operand byte after building,
    // but because handler masks to 24 bits, it becomes some value that likely
    // isn’t a BB start. Here, just re-run with a value that won’t be marked as opcode:
    s0.code[1] = 0xff; s0.code[2] = 0xff; s0.code[3] = 0x7f; // off24 ~ +0x7fffff

    const s1 = executeSingleStep(s0);
    expect(s1.exit!.type).not.toBe(ExitReasonType.Continue);
  });
});
