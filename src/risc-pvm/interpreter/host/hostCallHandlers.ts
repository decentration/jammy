import { GAS_HOST_CALL } from "../consts";
import { InterpreterState, ExitReasonType } from "../types";
import { OK, WHAT } from "./consts";
import { fetchHandler } from "./handlers/general/fetchHandler";
import { lookupHandler } from "./handlers/general/lookupHandler";
import { readHandler } from "./handlers/general/readHandler";
import { writeHandler } from "./handlers/general/writeHandler";
import { infoHandler } from "./handlers/general/infoHandler";
import { HostEnvInterface } from "./hostEnvInterface";
import { HostCallHandler } from "./types";
import { historicalLookupHandler } from "./handlers/historicalLookupHandler";
import { exportHandler } from "./handlers/exportHandler";
import { machineHandler } from "./handlers/machineHandler";
import { peekHandler } from "./handlers/peekHandler";
import { pokeHandler } from "./handlers/pokeHandler";
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
import { provideHandler } from "./handlers/accumulate/provideHandler";

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
  26: provideHandler, // Ω♈ - provide (Accumulate)
};




export function dispatchHostCall(state: InterpreterState, env: HostEnvInterface): InterpreterState {
if (state.exit?.type !== ExitReasonType.HostCall || state.exit.id === undefined) 
  return state; 
    
const selector = Number(state.exit.id);
console.log("[host] sel=", selector);
const handler = HostCallHandlers[selector] ?? unknownHandler; // when handler undefined use unknown handler. 

const { state: s1, ok } = handler(state, BigInt(selector), env);
console.log("[host] ok=", ok, "exit=", s1.exit ? ExitReasonType[s1.exit.type] : "∅",
  "r7=", s1.registers[7], "r8=", s1.registers[8]);

  if (ok && (!s1.exit || s1.exit.type === ExitReasonType.HostCall)) {
    return { ...s1, exit: { type: ExitReasonType.Continue } };
  }
  return s1;
}