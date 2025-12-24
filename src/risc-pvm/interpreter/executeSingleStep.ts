import { GAS_PER_INSTRUCTION } from "./consts";
import { decodeInstruction } from "./instructions/decodeInstruction";
import { instructionHandlers } from "./instructions/instructionHandlers";
import { Opcodes } from "./instructions/opcodes";
import { ExitReason, ExitReasonType, InterpreterState } from "./types";
import { skip } from "./utils/skip";
import { isValidationEnabled, capturePreState, validatePostState, dumpLastValidations } from "./debug/instructionValidator";

const ExitReasonTypeName = [
  "Continue", "Halt", "Panic", "OutOfGas", "PageFault", "HostCall",
] as const;

// Helps debug tight loops without flooding logs.
const seenLoopPcs = new Set<number>();
const traceBranchCounts = new Map<number, number>();
let traceBranchTotal = 0;
const TRACE_PC_BASE = 17225;
const TRACE_BRANCH_OPS = new Set<number>([
  Opcodes.branch_eq,
  Opcodes.branch_ne,
  Opcodes.branch_lt_u,
  Opcodes.branch_lt_s,
  Opcodes.branch_ge_u,
  Opcodes.branch_ge_s,
  Opcodes.branch_eq_imm,
  Opcodes.branch_ne_imm,
  Opcodes.branch_lt_u_imm,
  Opcodes.branch_le_u_imm,
  Opcodes.branch_ge_u_imm,
  Opcodes.branch_gt_u_imm,
  Opcodes.branch_lt_s_imm,
  Opcodes.branch_le_s_imm,
  Opcodes.branch_ge_s_imm,
  Opcodes.branch_gt_s_imm,
  Opcodes.load_imm_jump,
  Opcodes.load_imm_jump_ind,
]);

function stringifyExit(e?: ExitReason): string {
  if (!e) return "undefined";
  const t = ExitReasonTypeName[e.type] ?? String(e.type);
  const d = e.detail !== undefined ? ` detail=${String(e.detail)}` : "";
  const id = e.id !== undefined ? ` id=${e.id.toString()}` : "";
  return `${t}${d}${id}`;
}




/* Executes a single step in the interpreter.
 * This function decodes the instruction at the current program counter (pc),
  * looks up the corresponding execution handler, and executes it.

  
  * @param state - The current interpreter state.
  * @return The updated interpreter state after executing the step.
 */
export function executeSingleStep(state: InterpreterState): InterpreterState {
  if (state.exit?.type !== ExitReasonType.Continue) return state; // Explicit enum comparison
  if (state.gas <= 0n) return { ...state, exit: { type: ExitReasonType.OutOfGas } }

  // --- DEBUG: before decode/exec ---
  const DBG = process.env.DEBUG_STEP === "1";
  if (DBG) console.log("=== executeSingleStep ===");



  // const opcode = state.code[state.pc];
  // const skipLength = skip(state.pc, state.opcodeMaskBits);
  // const operands = Array.from(state.code.slice(state.pc + 1, state.pc + 1 + skipLength));
  const instr = decodeInstruction(state.code, state.pc, state.opcodeMaskBits);
  const instrLen = (instr as any).length ?? (1 + skip(state.pc, state.opcodeMaskBits));
  const TRACE_BRANCH_ENV = process.env.TRACE_POSTLOCK_BRANCH === "1";
  const TRACE_BRANCH = TRACE_BRANCH_ENV && state.pc >= TRACE_PC_BASE;

  // print each unique PC once for a tight suspect region.
  if (process.env.DEBUG_LOOP_192 === "1" && state.pc >= 19240 && state.pc <= 19310) {
    if (!seenLoopPcs.has(state.pc)) {
      seenLoopPcs.add(state.pc);
      const raw = Array.from(state.code.slice(state.pc, state.pc + (instr as any).length));
      const opsSafe = (instr.operands ?? []).map((o) => (typeof o === "bigint" ? o.toString() : o));
      const regsSnap = state.registers.slice(0, 13).map((r, i) => `r${i}=0x${r.toString(16)}`);
      let extra = "";
      if (state.pc === 19240) {
        const addr = 0x32760;
        const bytes = Array.from(state.memory.slice(addr, addr + 4));
        extra += ` mem[0x${addr.toString(16)}..+4]=[${bytes.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(",")}]`;
      }
      if (state.pc === 19270) {
        const r8 = Number(state.registers[8] & 0xFFFF_FFFFn);
        const bytes = Array.from(state.memory.slice(r8, r8 + 8));
        extra = ` mem[0x${r8.toString(16)}..+8]=[${bytes.map((b) => "0x" + b.toString(16).padStart(2, "0")).join(",")}]`;
      }
      console.log(
        `[dbg192xx] pc=${state.pc} op=${instr.opcode} len=${(instr as any).length} operands=${JSON.stringify(opsSafe)} raw=[${raw.map(b => '0x' + b.toString(16)).join(',')}] regs(${regsSnap.join(' ')})${extra}`
      );
    }
  }

  if (process.env.DEBUG_VM === "1" && instr.opcode === Opcodes.sbrk) {
    const rs = state.registers;
    const opsSafe = (instr.operands ?? []).map((o) => (typeof o === "bigint" ? o.toString() : o));
    console.log(
      `[dbg:sbrk] pre pc=${state.pc} operands=${JSON.stringify(opsSafe)} heapPtr=0x${state.context?.heapPointer?.toString(16) ?? "?"} heapEnd=0x${state.context?.heapEnd?.toString(16) ?? "?"} r7=0x${rs[7].toString(16)}`
    );
  }

  const bits = state.opcodeMaskBits as unknown as boolean[];
  if (bits && bits[state.pc] === false) {
    console.error("[vm] decode at non-opcode boundary", { pc: state.pc });
    return { ...state, exit: { type: ExitReasonType.Panic, detail: "decode-non-opcode" } };
  }

  if (DBG) {
    const opsLen = instr.operands ? instr.operands.length : 0;
    console.log(`[step] pc=${state.pc} op=${instr.opcode} ops=${opsLen} gas=${state.gas.toString()}`);
  }

  // Full trace for deep investigation (pc range filter; defaults tuned for accumulate conformance debugging)
  const TRACE_FULL = process.env.TRACE_FULL === "1";
  const TRACE_FROM = process.env.TRACE_FROM !== undefined ? Number(process.env.TRACE_FROM) : 17117;
  const TRACE_TO = process.env.TRACE_TO !== undefined ? Number(process.env.TRACE_TO) : 18400;
  if (TRACE_FULL && state.pc >= TRACE_FROM && state.pc <= TRACE_TO) {
    const regs = state.registers.slice(0, 13).map((r, i) => `r${i}=0x${r.toString(16)}`).join(' ');
    const opsSafe = (instr.operands ?? []).map((o) => typeof o === "bigint" ? o.toString() : o);
    console.log(`[FULL] pc=${state.pc} op=${instr.opcode} ops=${JSON.stringify(opsSafe)} ${regs}`);
  }

  // Targeted debugging for the accumulate conformance path around pc≈17140–17200
  const DBG_VM = process.env.DEBUG_VM === "1";
  if (DBG_VM && state.pc >= 17140 && state.pc <= 17200) {
    const raw = Array.from(state.code.slice(state.pc, state.pc + (instr as any).length));
    const regsSnap = state.registers.slice(0, 11).map((r, i) => `r${i}=0x${r.toString(16)}`);
    const opsSafe = (instr.operands ?? []).map((o) =>
      typeof o === "bigint" ? o.toString() : o
    );
    console.log(
      `[dbg171xx] pc=${state.pc} op=${instr.opcode} len=${(instr as any).length} operands=${JSON.stringify(opsSafe)} raw=[${raw.map(b => '0x' + b.toString(16)).join(',')}] regs(${regsSnap.join(' ')})`
    );
  }

  // Targeted debugging around the first observed write to 0x32760 (pc≈17225).
  // Use DEBUG_172=1 to enable without turning on all other VM debug.
  const DBG_172 = process.env.DEBUG_172 === "1";
  if ((DBG_VM || DBG_172) && state.pc >= 17210 && state.pc <= 17240) {
    const raw = Array.from(state.code.slice(state.pc, state.pc + (instr as any).length));
    const regsSnap = state.registers.slice(0, 13).map((r, i) => `r${i}=0x${r.toString(16)}`);
    const opsSafe = (instr.operands ?? []).map((o) =>
      typeof o === "bigint" ? o.toString() : o
    );
    const addr = 0x32760;
    const mem4 = Array.from(state.memory.slice(addr, addr + 4)).map((b) => "0x" + b.toString(16).padStart(2, "0"));
    console.log(
      `[dbg1722x] pc=${state.pc} op=${instr.opcode} len=${(instr as any).length} operands=${JSON.stringify(opsSafe)} raw=[${raw.map(b => '0x' + b.toString(16)).join(',')}] mem[0x${addr.toString(16)}..+4]=[${mem4.join(',')}] regs(${regsSnap.join(' ')})`
    );
  }

  if (DBG_VM && state.pc >= 8500 && state.pc <= 8565) {
    const raw = Array.from(state.code.slice(state.pc, state.pc + (instr as any).length));
    const regsSnap = state.registers.slice(0, 11).map((r, i) => `r${i}=0x${r.toString(16)}`);
    const opsSafe = (instr.operands ?? []).map((o) =>
      typeof o === "bigint" ? o.toString() : o
    );
    console.log(
      `[dbg85xx] pc=${state.pc} op=${instr.opcode} len=${(instr as any).length} operands=${JSON.stringify(opsSafe)} raw=[${raw.map(b => '0x' + b.toString(16)).join(',')}] regs(${regsSnap.join(' ')})`
    );
  }
  // Targeted debugging for suspected ΩW (ecalli 4) sites in this service blob.
  if (DBG_VM && state.pc >= 7920 && state.pc <= 8105) {
    const raw = Array.from(state.code.slice(state.pc, state.pc + (instr as any).length));
    const opsSafe = (instr.operands ?? []).map((o) =>
      typeof o === "bigint" ? o.toString() : o
    );
    console.log(
      `[dbg79xx] pc=${state.pc} op=${instr.opcode} len=${(instr as any).length} operands=${JSON.stringify(opsSafe)} raw=[${raw.map(b => '0x' + b.toString(16)).join(',')}]`
    );
  }

  if (DBG_VM && instr.opcode === Opcodes.ecalli && (instr.operands?.[0] === 4 || instr.operands?.[0] === 4n)) {
    console.log(`[dbg:ecalli4] pc=${state.pc} raw=[0x${state.code[state.pc].toString(16)},0x${state.code[state.pc + 1]?.toString(16) ?? '??'}]`);
  }
  if (DBG_VM && state.pc >= 12690 && state.pc <= 12740) {
    const raw = Array.from(state.code.slice(state.pc, state.pc + (instr as any).length));
    const regsSnap = state.registers.slice(0, 13).map((r, i) => `r${i}=0x${r.toString(16)}`);
    const opsSafe = (instr.operands ?? []).map((o) =>
      typeof o === "bigint" ? o.toString() : o
    );
    console.log(
      `[dbg127xx] pc=${state.pc} op=${instr.opcode} len=${(instr as any).length} operands=${JSON.stringify(opsSafe)} raw=[${raw.map(b => '0x' + b.toString(16)).join(',')}] regs(${regsSnap.join(' ')})`
    );
  }

  // Targeted debugging near the observed trap/log epilogue in the accumulate conformance path
  if (DBG_VM && state.pc >= 18470 && state.pc <= 18510) {
    const raw = Array.from(state.code.slice(state.pc, state.pc + (instr as any).length));
    const regsSnap = state.registers.slice(0, 13).map((r, i) => `r${i}=0x${r.toString(16)}`);
    const opsSafe = (instr.operands ?? []).map((o) =>
      typeof o === "bigint" ? o.toString() : o
    );
    console.log(
      `[dbg184xx] pc=${state.pc} op=${instr.opcode} len=${(instr as any).length} operands=${JSON.stringify(opsSafe)} raw=[${raw.map(b => '0x' + b.toString(16)).join(',')}] regs(${regsSnap.join(' ')})`
    );
  }

  if (process.env.DEBUG_VM === "1" && instr.opcode === Opcodes.load_imm_jump) {
    // best-effort raw bytes around pc (16 is plenty for this instruction)
    const raw = Array.from(state.code.slice(state.pc, state.pc + 16));
    // if decodeInstruction exposes byteLength, use it; else estimate via skip
    const approxLen = (instr as any).byteLength ?? (1 + skip(state.pc, state.opcodeMaskBits));
    console.log("[DISPATCH 80] pre-call", {
      pc: state.pc,
      opcode: instr.opcode,
      mode: state.code[state.pc + 1],
      operands: instr.operands,
      approxLen,
      raw,
      hasHandler: !!instructionHandlers[instr.opcode],
      handlerName: instructionHandlers[instr.opcode]?.name,
    });
  }


  const handler = instructionHandlers[instr.opcode];
  if (!handler) {
    console.log("Unknown opcode at pc:", state.pc, "opcode:", instr.opcode);
    const gas = state.gas - GAS_PER_INSTRUCTION; // TODO, produce a test and check against current tests. 
    return { ...state, gas, exit: { type: ExitReasonType.Panic } }; // unknown opcode
  }

  // --- Charge base gas for this instruction ---
  let gasAfterBase = state.gas - GAS_PER_INSTRUCTION;
  if (gasAfterBase <= 0n) {
    const next: InterpreterState = {
      ...state,
      gas: 0n,
      exit: { type: ExitReasonType.OutOfGas },
    };
    if (DBG) {
      console.log(
        `[step→] OutOfGas after base charge, pc=${state.pc} gasStart=${state.gas.toString()}`,
      );
    }
    if (DBG) {
      console.log(
        `[step→] exit=${stringifyExit(next.exit)} gas=${next.gas.toString()} pc=${next.pc}`,
      );
    }


    return next;
  }

  const stateForHandler: InterpreterState = {
    ...state,
    gas: gasAfterBase,
  };

  // Capture pre-state for validation if enabled
  const operands = instr.operands ?? [];
  const numOperands = operands.map(o => typeof o === 'bigint' ? o : (o instanceof Uint8Array ? 0 : Number(o)));
  const validation = isValidationEnabled()
    ? capturePreState(stateForHandler, instr.opcode, numOperands)
    : null;

  const newState = handler(stateForHandler, operands);

  if (process.env.DEBUG_VM === "1" && instr.opcode === Opcodes.sbrk) {
    const ns = newState.registers;
    console.log(
      `[dbg:sbrk] post pc=${newState.pc} exit=${stringifyExit(newState.exit!)} heapPtr=0x${newState.context?.heapPointer?.toString(16) ?? "?"} r7=0x${ns[7].toString(16)}`
    );
  }

  // Validate post-state if enabled
  if (validation) {
    try {
      validatePostState(validation, newState);
    } catch (e) {
      dumpLastValidations(20);
      throw e;
    }
  }

  if (process.env.DEBUG_VM === "1" && state.pc === 12646) {
    console.log(`[TRACE-12646] PC=12646 Regs: ${newState.registers.map(r => `0x${r.toString(16)}`).join(', ')}`);
  }
  if (process.env.DEBUG_VM === "1") {
    // Targeted window around the first ΩY fetch call (pc≈17117) to understand ABI + branching.
    if (state.pc >= 17100 && state.pc <= 17140) {
      const rs = state.registers;
      const opsSafe = (instr.operands ?? []).map((o) =>
        typeof o === "bigint" ? o.toString() : o
      );
      console.log(
        `[debug171xx] pre pc=${state.pc} op=${instr.opcode} operands=${JSON.stringify(opsSafe)} r5=0x${rs[5].toString(16)} r6=0x${rs[6].toString(16)} r7=0x${rs[7].toString(16)} r8=0x${rs[8].toString(16)} r9=0x${rs[9].toString(16)} r10=0x${rs[10].toString(16)} r11=0x${rs[11].toString(16)} r12=0x${rs[12].toString(16)}`
      );
      const ns = newState.registers;
      console.log(
        `[debug171xx] post pc=${newState.pc} exit=${stringifyExit(newState.exit!)} r6=0x${ns[6].toString(16)} r7=0x${ns[7].toString(16)} r8=0x${ns[8].toString(16)}`
      );
    }
  }

  if (process.env.DEBUG_VM === "1") {
    // Follow-up window after the branch at pc≈17154 (often jumps to ~174xx).
    if (state.pc >= 17440 && state.pc <= 17560) {
      const rs = state.registers;
      const opsSafe = (instr.operands ?? []).map((o) =>
        typeof o === "bigint" ? o.toString() : o
      );
      console.log(
        `[debug174xx] pre pc=${state.pc} op=${instr.opcode} operands=${JSON.stringify(opsSafe)} r5=0x${rs[5].toString(16)} r6=0x${rs[6].toString(16)} r7=0x${rs[7].toString(16)} r8=0x${rs[8].toString(16)} r9=0x${rs[9].toString(16)} r10=0x${rs[10].toString(16)}`
      );
      const ns = newState.registers;
      console.log(
        `[debug174xx] post pc=${newState.pc} exit=${stringifyExit(newState.exit!)} r6=0x${ns[6].toString(16)} r7=0x${ns[7].toString(16)} r8=0x${ns[8].toString(16)}`
      );
    }
  }

  if (process.env.DEBUG_VM === "1") {
    // Deep dive: function jumped to from ~17501 (pc≈10659).
    if (state.pc >= 10640 && state.pc <= 10780) {
      const rs = state.registers;
      const opsSafe = (instr.operands ?? []).map((o) =>
        typeof o === "bigint" ? o.toString() : o
      );
      console.log(
        `[debug106xx] pre pc=${state.pc} op=${instr.opcode} operands=${JSON.stringify(opsSafe)} r5=0x${rs[5].toString(16)} r6=0x${rs[6].toString(16)} r7=0x${rs[7].toString(16)} r8=0x${rs[8].toString(16)} r9=0x${rs[9].toString(16)} r10=0x${rs[10].toString(16)}`
      );
      const ns = newState.registers;
      console.log(
        `[debug106xx] post pc=${newState.pc} exit=${stringifyExit(newState.exit!)} r6=0x${ns[6].toString(16)} r7=0x${ns[7].toString(16)} r8=0x${ns[8].toString(16)}`
      );
    }
  }

  if (process.env.DEBUG_VM === "1") {
    // Deep dive: region where we later hit ΩZ log + trap (pc≈18387..18500).
    if (state.pc >= 18360 && state.pc <= 18520) {
      const rs = state.registers;
      const opsSafe = (instr.operands ?? []).map((o) =>
        typeof o === "bigint" ? o.toString() : o
      );
      console.log(
        `[debug184xx] pre pc=${state.pc} op=${instr.opcode} operands=${JSON.stringify(opsSafe)} r5=0x${rs[5].toString(16)} r6=0x${rs[6].toString(16)} r7=0x${rs[7].toString(16)} r8=0x${rs[8].toString(16)} r9=0x${rs[9].toString(16)} r10=0x${rs[10].toString(16)} r11=0x${rs[11].toString(16)} r12=0x${rs[12].toString(16)}`
      );
      const ns = newState.registers;
      console.log(
        `[debug184xx] post pc=${newState.pc} exit=${stringifyExit(newState.exit!)} r6=0x${ns[6].toString(16)} r7=0x${ns[7].toString(16)} r8=0x${ns[8].toString(16)}`
      );
    }
  }

  if (TRACE_BRANCH && TRACE_BRANCH_OPS.has(instr.opcode)) {
    const count = (traceBranchCounts.get(state.pc) ?? 0) + 1;
    const total = traceBranchTotal + 1;
    traceBranchCounts.set(state.pc, count);
    traceBranchTotal = total;
    if (count <= 4 && total <= 400) {
      const fallthrough = state.pc + instrLen;
      const taken = newState.pc !== fallthrough;
      const rs = state.registers;
      const ns = newState.registers;
      console.log(
        `[trace:br] pc=${state.pc} op=${instr.opcode} taken=${taken} fallthrough=0x${fallthrough.toString(16)} nextPc=0x${newState.pc.toString(16)} exit=${stringifyExit(newState.exit)} pre(r5=0x${rs[5].toString(16)} r6=0x${rs[6].toString(16)} r7=0x${rs[7].toString(16)} r8=0x${rs[8].toString(16)}) post(r6=0x${ns[6].toString(16)} r7=0x${ns[7].toString(16)} r8=0x${ns[8].toString(16)})`
      );
    }
  }

  // Track r12 modifications - key for debugging the panic issue
  const DBG_R12 = process.env.DEBUG_R12 === "1";
  if (DBG_R12 && stateForHandler.registers[12] !== newState.registers[12]) {
    console.log(`[R12-CHANGE] pc=${state.pc} op=${instr.opcode} r12: 0x${stateForHandler.registers[12].toString(16)} -> 0x${newState.registers[12].toString(16)} operands=${JSON.stringify(operands.map(o => typeof o === 'bigint' ? o.toString() : o))}`);
  }

  // Track all register changes for comprehensive debugging
  const DBG_REGS = process.env.DEBUG_REGS === "1";
  if (DBG_REGS) {
    for (let i = 0; i < 13; i++) {
      if (stateForHandler.registers[i] !== newState.registers[i]) {
        console.log(`[REG-CHANGE] pc=${state.pc} op=${instr.opcode} r${i}: 0x${stateForHandler.registers[i].toString(16)} -> 0x${newState.registers[i].toString(16)} operands=${JSON.stringify(operands.map(o => typeof o === 'bigint' ? o.toString() : o))}`);
      }
    }
  } else if (process.env.DEBUG_VM === "1" && stateForHandler.registers[6] !== newState.registers[6]) {
    console.log(`[R6-CHANGE] pc=${state.pc} op=${instr.opcode} r6: 0x${stateForHandler.registers[6].toString(16)} -> 0x${newState.registers[6].toString(16)} operands=${JSON.stringify(operands.map(o => typeof o === 'bigint' ? o.toString() : o))}`);
  }

  if (!newState.exit) {
    newState.exit = { type: ExitReasonType.Continue };
  }

  // Normalize OutOfGas if gas went <= 0 while still "continuing".
  if (newState.gas <= 0n && newState.exit.type === ExitReasonType.Continue) {
    newState.gas = 0n;
    newState.exit = { type: ExitReasonType.OutOfGas };
  }

  if (DBG) {
    console.log(
      `[step→] exit=${stringifyExit(newState.exit)} gas=${newState.gas.toString()} pc=${newState.pc}`,
    );
  }

  return newState;
}
