import { GAS_HOST_CALL } from "../consts";
import { InterpreterState, ExitReasonType } from "../types";
import { OK, WHAT, NONE, OOB } from "./consts";
import {
  isHostTraceEnabled,
  dumpHostCallEntry,
  dumpHostCallExit,
  recordHostCallTrace
} from "../debug/hostCallTracer";
import { fetchHandler } from "./handlers/general/fetchHandler";
import { lookupHandler } from "./handlers/general/lookupHandler";
import { readHandler } from "./handlers/general/readHandler";
import { writeHandler } from "./handlers/general/writeHandler";
import { infoHandler } from "./handlers/general/infoHandler";
import { readBytes } from "../instructions/helpers";
import { HostEnvInterface } from "./hostEnvInterface";
import { HostCallHandler } from "./types";
import { historicalLookupHandler } from "./handlers/refine/historicalLookupHandler";
import { exportHandler } from "./handlers/refine/exportHandler";
import { machineHandler } from "./handlers/refine/machineHandler";
import { peekHandler } from "./handlers/refine/peekHandler";
import { pokeHandler } from "./handlers/refine/pokeHandler";
import { invokeHandler } from "./handlers/refine/invokeHandler";
import { expungeHandler } from "./handlers/refine/expungeHandler";
import { blessHandler } from "./handlers/accumulate/blessHandler";
import { assignHandler } from "./handlers/accumulate/assignHandler";
import { designateHandler } from "./handlers/accumulate/designateHandler";
import { checkpointHandler } from "./handlers/accumulate/checkpointHandler";
import { newHandler } from "./handlers/accumulate/newHandler";
import { upgradeHandler } from "./handlers/accumulate/upgradeHandler";
import { transferHandler } from "./handlers/accumulate/transferHandler";
import { pagesHandler } from "./handlers/refine/pagesHandler";
import { ejectHandler } from "./handlers/accumulate/ejectHandler";
import { queryHandler } from "./handlers/accumulate/queryHandler";
import { yieldHandler } from "./handlers/accumulate/yieldHandler";
import { forgetHandler } from "./handlers/accumulate/forgetHandler";
import { solicitHandler } from "./handlers/accumulate/solicitHandler";
import { provideHandler } from "./handlers/accumulate/provideHandler";

// GAS (ΩG) - selector 0 
const gasHandler: HostCallHandler = (state, id, env) => {

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

// Default "unknown selector" - B.17: just set r7 = WHAT and continue
// Add explicit OOG check before returning WHAT
const unknownHandler: HostCallHandler = (state, id, env) => {
  // Check for OOG before processing
  if (state.gas < GAS_HOST_CALL) {
    return {
      state: { ...state, exit: { type: ExitReasonType.OutOfGas } },
      ok: true,
    };
  }

  const registers = state.registers.slice();
  registers[7] = WHAT; // B.17 / B.18 - unknown selector, set WHAT and continue
  return {
    state: {
      ...state,
      registers,
      exit: { type: ExitReasonType.Continue }
    }, ok: true
  };
}

// LOG (ΩZ) - selector 100 - JIP-1
// Log host call for debug. Per JIP-1 it must have no effect on machine state.
// However, conformance services may expect r6 (error code) to be cleared on success.
const logHandler: HostCallHandler = (state, id, env) => {

  const r7 = Number(state.registers[7] & 0xFFFFFFFFn);
  const r8 = Number(state.registers[8] & 0xFFFFFFFFn);
  const r9 = Number(state.registers[9] & 0xFFFFFFFFn);
  const r10 = Number(state.registers[10] & 0xFFFFFFFFn);
  const r11 = Number(state.registers[11] & 0xFFFFFFFFn);
  const r12 = Number(state.registers[12] & 0xFFFFFFFFn);

  const hasNewAbi = r10 !== 0 && r11 !== 0;
  const target = hasNewAbi ? r12 : r7;
  const source = hasNewAbi ? r10 : r8;
  const length = hasNewAbi ? r11 : r9;

  if (process.env.JAM_DEBUG_HOST === "1") {
    if (source > 0 && length > 0 && length < 1024) {
      const want = Math.min(length, 256);
      const rb = readBytes(state, source, want);
      const bytes = rb.bytes ?? state.memory.slice(source, source + want);
      try {
        const text = new TextDecoder().decode(bytes);
        if (text.replace(/\u0000/g, "").trim().length === 0) {
          console.log(
            `[host:log] target=0x${target.toString(16)} source=0x${source.toString(16)} len=${length} bytesHex=${Buffer.from(bytes.slice(0, 64)).toString("hex")}`
          );
        } else {
          console.log(
            `[host:log] target=0x${target.toString(16)} source=0x${source.toString(16)} len=${length} msg="${text}"`
          );
        }
      } catch {
        console.log(`[host:log] target=0x${target.toString(16)} source=0x${source.toString(16)} len=${length} bytes=[${Array.from(bytes.slice(0, 32)).join(',')}...]`);
      }
    } else {
      console.log(`[host:log] target=0x${target.toString(16)} source=0x${source.toString(16)} len=${length}`);
    }
  }

  // Conformance service ABI: clear r6 on success.
  const registers = state.registers.slice();
  registers[6] = 0n;
  registers[7] = OK;
  return { state: { ...state, registers }, ok: true };
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
  100: logHandler, // ΩZ - log (JIP-1)
};


// Host call selector names for debugging
const HOST_CALL_NAMES: Record<number, string> = {
  0: "gas", 1: "fetch", 2: "lookup", 3: "read", 4: "write", 5: "info",
  6: "historicalLookup", 7: "export", 8: "machine", 9: "peek", 10: "poke",
  11: "pages", 12: "invoke", 13: "expunge", 14: "bless", 15: "assign",
  16: "designate", 17: "checkpoint", 18: "new", 19: "upgrade", 20: "transfer",
  21: "eject", 22: "query", 23: "solicit", 24: "forget", 25: "yield", 26: "provide",
  100: "log"
};

export function dispatchHostCall(state: InterpreterState, env: HostEnvInterface): InterpreterState {
  if (state.exit?.type !== ExitReasonType.HostCall || state.exit.id === undefined)
    return state;

  // Increment host call counter for gas overhead calculation (g=10, B.5)
  env.incrementHostCallCount?.();

  const selector = Number(state.exit.id);
  const handlerName = HOST_CALL_NAMES[selector] ?? "unknown";
  const isKnown = selector in HostCallHandlers;
  const DBG = process.env.JAM_DEBUG_HOST === "1";
  const TRACE_LOCK_HOST =
    process.env.JAM_TRACE_POSTLOCK_HOST === "1" && state.pc >= 17225;

  // input logging
  const r7 = state.registers[7];
  const r8 = state.registers[8];
  const r9 = state.registers[9];
  const r10 = state.registers[10];
  const r11 = state.registers[11];
  const r12 = state.registers[12];

  if (DBG || TRACE_LOCK_HOST) {
    console.log(`[host:in] sel=${selector} (${handlerName}) known=${isKnown} pc=${state.pc} gas=${state.gas}`);
    console.log(`[host:in]   r7=0x${r7.toString(16)} r8=0x${r8.toString(16)} r9=0x${r9.toString(16)} r10=0x${r10.toString(16)}`);
    console.log(`[host:in]   r11=0x${r11.toString(16)} r12=0x${r12.toString(16)}`);
  }

  // Full state dump if JAM_DEBUG_HOST=1
  dumpHostCallEntry(state, selector, handlerName);

  const handler = HostCallHandlers[selector] ?? unknownHandler;
  const { state: s1, ok } = handler(state, BigInt(selector), env);

  // output logging
  const exitType = s1.exit ? ExitReasonType[s1.exit.type] : "∅";
  const r7Out = s1.registers[7];
  const r8Out = s1.registers[8];
  const r6Out = s1.registers[6];

  if (DBG || TRACE_LOCK_HOST) {
    console.log(`[host:out] sel=${selector} (${handlerName}) ok=${ok} exit=${exitType}`);
    console.log(`[host:out]   r6=0x${r6Out.toString(16)} r7=0x${r7Out.toString(16)} r8=0x${r8Out.toString(16)}`);
  }

  // Check for special return values
  if (DBG || TRACE_LOCK_HOST) {
    if (r7Out === WHAT) console.log(`[host:out]   r7=WHAT (unknown/invalid)`);
    if (r7Out === NONE) console.log(`[host:out]   r7=NONE (not found)`);
    if (r7Out === OOB) console.log(`[host:out]   r7=OOB (out of bounds)`);
  }

  // Full state dump and trace recording if JAM_DEBUG_HOST=1
  dumpHostCallExit(s1, selector, handlerName, ok);
  recordHostCallTrace(state, selector, handlerName, s1, ok);

  // Advance PC past ecalli instruction (length from exit.detail, fallback=3)
  const ecalliLength = typeof state.exit?.detail === 'number' ? state.exit.detail : 3;
  let newPc = s1.pc + ecalliLength;

  // SDK pads ecalli with fallthrough (0x01); skip it and charge 1 gas (except bootstrap service)
  const currentServiceId = env.acc?.allocator?.env?.currentServiceId;
  const isBootstrapService = currentServiceId === 0n || currentServiceId === BigInt(0);

  let fallthroughGasCharge = 0n;
  if (!isBootstrapService && s1.code?.[newPc] === 0x01) {
    newPc += 1;
    fallthroughGasCharge = 1n;
  }

  const s2 = {
    ...s1,
    pc: newPc,
    gas: s1.gas - fallthroughGasCharge,
  };

  if (ok && (!s2.exit || s2.exit.type === ExitReasonType.HostCall)) {
    return { ...s2, exit: { type: ExitReasonType.Continue } };
  }
  return s2;
}