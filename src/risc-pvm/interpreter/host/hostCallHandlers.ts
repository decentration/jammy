import { GAS_HOST_CALL } from "../consts";
import { readBytes, toLE, writeBytes } from "../instructions/helpers";
import { InterpreterState, ExitReasonType } from "../types";
import { HUH, NONE, OK, OOB, WHAT } from "./consts";
import { fetchHandler } from "./handlers/fetchHandler";
import { lookupHandler } from "./handlers/lookupHandler";
import { readHandler } from "./handlers/readHandler";
import { writeHandler } from "./handlers/writeHandler";
import { infoHandler } from "./handlers/infoHandler";
import { HostEnvInterface } from "./hostEnvInterface";
import { HostCallHandler } from "./types";
import { historicalLookupHandler } from "./handlers/historicalLookupHandler";
import { exportHandler } from "./handlers/exportHandler";
import { machineHandler } from "./handlers/machineHandler";
import { peekHandler } from "./handlers/peekHandler";
import { pokeHandler } from "./handlers/pokeHandler";
import { voidHandler } from "./handlers/voidHandler";
import { zeroHandler } from "./handlers/zeroHandler";
import { invokeHandler } from "./handlers/invokeHandler";
import { expungeHandler } from "./handlers/expungeHandler";
import { blessHandler } from "./handlers/accumulate/blessHandler";
import { assignHandler } from "./handlers/accumulate/assignHandler";
import { designateHandler } from "./handlers/accumulate/designateHandler";
import { checkpointHandler } from "./handlers/accumulate/checkpointHandler";
import { newHandler } from "./handlers/accumulate/newHandler";
import { upgradeHandler } from "./handlers/accumulate/upgradeHandler";
import { transferHandler } from "./handlers/accumulate/transferHandler";
import { pagesHandler } from "./handlers/pagesHandler";
import { ejectHandler } from "./handlers/accumulate/ejectHandler";
import { queryHandler } from "./handlers/accumulate/queryHandler";
import { yieldHandler } from "./handlers/accumulate/yieldHandler";
import { forgetHandler } from "./handlers/accumulate/forgetHandler";
import { solicitHandler } from "./handlers/accumulate/solicitHandler";

// GAS (ΩG) - selector 0 
const gasHandler: HostCallHandler = (state, id, env ) => {

  if (id !== OK) {
    return { state, ok: false };
  }

  if (state.gas < GAS_HOST_CALL) {
    return {
      state: { ...state, exit: { type: ExitReasonType.OutOfGas } },
      ok: true,
    };
  }
  
  const registers = state.registers.slice();
  registers[7] = BigInt(state.gas); // B.17 / B.18
  
  return { state: { ...state, registers }, ok: true };
};

// // READ (ΩR) — selector 2
// const readHandler: HostCallHandler = (s, _id, env) => {
//   const addr  = Number(s.registers[8]);
//   const len   = Number(s.registers[9]);
//   const rd    = Number(s.registers[10]) & 0xF;    // clamp 0‑15, 
//   if (len < 1 || len > 8) return pageFault(s, addr);   // only small reads for now

//   const { bytes, state: s1 } = readBytes(s, addr, len);
//   if (!bytes) return { state: s1, ok: false };     // Page‑fault propagated

//   let v = 0n;
//   for (let i = 0; i < len; i++) v |= BigInt(bytes[i]) << (8n * BigInt(i));

//   const r = s1.registers.slice();
//   r[rd] = v;
//   r[7]  = OK;

//   return { state: { ...s1, registers: r, exit: { type: ExitReasonType.Continue } }, ok: true };
// };


// // WRITE (ΩW) — selector 3
// const writeHandler: HostCallHandler = (s, _id, env) => {
//   const addr  = Number(s.registers[8]);
//   const len   = Number(s.registers[9]);
//   const value = s.registers[10];

//   if (len < 1 || len > 8) return pageFault(s, addr);

//   const data = toLE(value, len as | 1 | 2 | 4 | 8);
//   const s1   = writeBytes(s, addr, data);

//   if (s1.exit?.type === ExitReasonType.PageFault) return { state: s1, ok: false };

//   const r = s1.registers.slice();
//   r[7] = OK;

//   return { state: { ...s1, registers: r, exit: { type: ExitReasonType.Continue } }, ok: true };
// };

// // LOOKUP (ΩL) — selector 1
// const lookupHandler: HostCallHandler = (state, id, env) => {
//   // until storage implemented, always return NONE
//   const registers = state.registers.slice();
//   registers[7] = NONE; // see spec for constant
//   return { state: { ...state, registers }, ok: true };
// };

// // ZERO (ΩZ) and VOID (ΩV) — selectors 5 and 6
// const zeroOrVoid =
//   (isVoid: boolean): HostCallHandler =>
//   (state, id) => {

//     if ((isVoid ? id !== 24n : id !== 23n)) return { state, ok: false };

//     const addr = Number(state.registers[8]);   // r8 = start
//     const len  = Number(state.registers[9]);   // r9 = length

//     // bounds & page permissions
//     const s1 = writeBytes(state, addr, new Uint8Array(len).fill(0));
//     const regs = s1.registers.slice();

//     if (s1.exit?.type === ExitReasonType.PageFault) {
//       regs[7] = OOB;
//       return { state: { ...s1, registers: regs }, ok: false };
//     }

//     regs[7] = OK;
//     return {
//       state: { ...s1, registers: regs, gas: s1.gas - 10 },
//       ok: true,
//     }; 
//   };

// const zeroHandler = zeroOrVoid(false); // 23
// const voidHandler = zeroOrVoid(true ); // 24


// // FORGET PRE-IMAGE (ΩF) - selector 15
// const forgetHandler: HostCallHandler = (state, id, env) => {
//   const regs = state.registers.slice();
//   regs[7] = HUH;                       // “already solicited / cannot forget”
//   return { state: { ...state, registers: regs }, ok: true };
// };

// //  FETCH (ΩY) — selector 18
// const fetchHandler: HostCallHandler = (state, id, env) => {
//   const registers = state.registers.slice();
//   registers[7] = WHAT; 
//   return { state: { ...state, registers }, ok: true };
// };


// // EXPORT (ΩE) – Export segment selector 19
// const exportHandler: HostCallHandler = (state, id, env) => {
//   const regs = state.registers.slice();
//   regs[7] = OK;
//   return { state: { ...state, registers: regs }, ok: true };
// };

// // PEEK (ΩK) — selector 21
// const peekHandler: HostCallHandler = (state, id, env) => {
//   const registers = state.registers.slice();
//   registers[7] = WHAT; // !TODO No inner PVM yet
//   return { state: { ...state, registers }, ok: true };
// };

// // POKE (ΩP) — selector 22
// const pokeHandler: HostCallHandler = (state, id, env) => {
//   const registers = state.registers.slice();
//   registers[7] = WHAT; // !TODO wait till we support inner PVMs
//   return { state: { ...state, registers }, ok: true };
// };

// Defualt "uknown selector" 
const unknownHandler: HostCallHandler = (state, id, env) => {
  const registers = state.registers.slice();
  registers[7] = WHAT; // B.17 / B.18
  return { 
      state: { 
          ...state, 
          registers,
          exit: { type: ExitReasonType.Panic, detail: `unknown-host-call ${id}` }
      }, ok: false };
}

const stubHandler: HostCallHandler = (state, id, env) => {
  // charge the call
  if (state.gas < GAS_HOST_CALL) {
    // honour out‑of‑gas just like the real handlers
    return {
      state: { ...state, exit: { type: ExitReasonType.OutOfGas } },
      ok   : true
    };
  }

  const regs = state.registers.slice();
  regs[7] = WHAT;                // B.1 – “name unknown”

  return {
    state: { ...state, registers: regs},
    ok   : true
  };
};

const STUB_SELECTORS = [
   5, 6,        
  7, 8, 9, 10, 11, 12, 13, 14,
  16,  
  25, 26,                    
  27 
] as const;


const HostCallHandlers: Record<number, HostCallHandler> = {
  0: gasHandler, // general ΩG
  1: fetchHandler, // general ΩY
  2: lookupHandler, // general ΩL
  3: readHandler, // general  ΩR
  4: writeHandler, // general ΩW
  5: infoHandler, // general ΩI
  6: historicalLookupHandler, // REfine - ΩH - historical lookup ()
  7: exportHandler,    // ΩE - export segment (Refine)
  8: machineHandler, // ΩM - machine info (Refine)
  9: peekHandler,      // ΩK - peek (Refine)
  10: pokeHandler,      // ΩP - poke (Refine)
  11: pagesHandler,
  12: invokeHandler, // ΩI - invoke (Refine)
  13: expungeHandler, // ΩX - expunge (Refine)

  14: blessHandler, // ΩB - bless (Accumulator)
  15: assignHandler, // ΩA - assign (Accumulator)
  16: designateHandler, // ΩD - designate (Accumulator)
  17: checkpointHandler, // ΩC - checkpoint (Accumulator)
  18: newHandler, // ΩN - new (Accumulator)
  19: upgradeHandler, // ΩU - upgrade (Accumulator)
  20: transferHandler, // ΩT - transfer (Accumulator)
  21: ejectHandler, // ΩJ - eject (Accumulator)
  22: queryHandler, // ΩQ - query (Accumulator)
  23: solicitHandler, // ΩS - solicit (Accumulator)//
  24: forgetHandler,    // ΩF - forget pre-image (Accumulator)
  25: yieldHandler, // Ω♉︎ - yield (Accumulator)
  // 18: fetchHandler,
  
  // 23: zeroHandler, // ΩZ - zero memory (refine)
  // 24: voidHandler, // ΩV - void memory (refine)

  // 26: provideHandler, // Ω♈ - provide (Accumulate)


};

for (const sel of STUB_SELECTORS) {
  if (!(sel in HostCallHandlers)) HostCallHandlers[sel] = stubHandler;
}

const pageFault = (s: InterpreterState, bad: number) => ({
  state: {
    ...s,
    exit: { type: ExitReasonType.PageFault, detail: bad }
  },
  ok: false
});

export function dispatchHostCall(state: InterpreterState, env: HostEnvInterface): InterpreterState {
if (state.exit?.type !== ExitReasonType.HostCall || state.exit.id === undefined) 
  return state; 
    
const selector = Number(state.exit.id);
console.log("dispatchHostCall", selector);
const handler = HostCallHandlers[selector] ?? unknownHandler; // when handler undefined use unknown handler. 

const { state: s1, ok } = handler(state, BigInt(selector), env);


if (ok && (!s1.exit || s1.exit.type === ExitReasonType.HostCall)) {
    return { ...s1, exit: { type: ExitReasonType.Continue } };
  }
  return s1;
}