import { GAS_COST_JUMP } from "../../risc-pvm/interpreter/consts";
import { branchHandler } from "../../risc-pvm/interpreter/instructions/instructionHandlers";
import { InterpreterState, ExitReasonType } from "../../risc-pvm/interpreter/types";

const nextPc = (s: InterpreterState) => s.pc + 1;

test("branchHandler: taken branch uses nextPc+off24 and charges gas", () => {
  //  a tiny basic block map that includes the target
  const starts = new Set<number>([0, 5]);
  const s: InterpreterState = {
    code: new Uint8Array([0]),
    opcodeMaskBits: [true],
    pc: 0,
    gas: 100n,
    registers: Array(13).fill(0n),
    memory: new Uint8Array(64),
    exit: { type: ExitReasonType.Continue },
    context: {
      jumpTable: [], jumpEntryLength: 0, basicBlockStarts: starts, heapStart: 0, heapPointer: 0, heapEnd: 64, pageTable: [] as any,
      argsBand: new Uint8Array(),
      stackBand: new Uint8Array(),
      argsBase: 0,
      stackStart: 0,
      stackTop: 0
    },
  };

  // condition: reg == imm
  const cond = (rv: bigint, iv: bigint) => rv === iv;

  // rA=0, imm=0, offRaw=4 => nextPc(0)=1; 1+4=5 (which is in starts)
  const handler = branchHandler(cond);
  const out = handler(s, [0, 0, 4]);

  expect(out.exit!.type).toBe(ExitReasonType.Continue);
  expect(out.pc).toBe(5);                  // jumped to a valid basic block start
  expect(out.gas).toBe(100n - GAS_COST_JUMP);
});

test("branchHandler: not taken falls through to nextPc and charges gas", () => {
  const starts = new Set<number>([0, 5]);
  const s: InterpreterState = {
    code: new Uint8Array([0]),
    opcodeMaskBits: [true],
    pc: 0,
    gas: 100n,
    registers: Array(13).fill(1n),  // r0=1
    memory: new Uint8Array(64),
    exit: { type: ExitReasonType.Continue },
    context: {
      jumpTable: [],
      jumpEntryLength: 0,
      basicBlockStarts: starts,
      heapStart: 0,
      heapPointer: 0,
      heapEnd: 64,
      pageTable: [] as any,
      argsBand: new Uint8Array(),
      stackBand: new Uint8Array(),
      argsBase: 0,
      stackStart: 0,
      stackTop: 0
    },
  };

  const cond = (rv: bigint, iv: bigint) => rv === iv; // will be false (1 != 0)
  const handler = branchHandler(cond);
  const out = handler(s, [0, 0, 4]);

  expect(out.pc).toBe(1);    // fallthrough to nextPc
  expect(out.gas).toBe(100n - GAS_COST_JUMP);
});
