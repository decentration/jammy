import { computeBasicBlockStarts } from "./computeBasicBlockStarts";
import { deblob } from "./deblob";
import { executeSingleStep } from "./executeSingleStep";
import { InterpreterState, ExitReasonType, ExitReason } from "./types";
import { bitmaskToBoolean } from "./utils/bitmask";
import { createPageTable, mapPages, Memory, IO_BASE, IO_SIZE } from "./memory";
import { dispatchHostCall } from "./host/hostCallHandlers";
import { HostEnvInterface, makeHostEnv } from "./host/hostEnvInterface";
import { HostDispatcher } from "./host/types";
import { Gas } from "../../types";
import { MapPlanEntry } from "./initializer/types";
import { ARGS_BASE, PAGE_SIZE, STACK_SIZE, STACK_START, STACK_TOP, ZI } from "./host/consts";
import { parseProgramContainer } from "./initializer/parseProgamContainer";


export interface RunBlobOpts {
  memory?: Memory;
  
  memSize?:   number; // total RAM bytes (default 1 MiB)
  heapStart?: number; // heap lower bound (default 0x10000)
  heapEnd?:   number; // heap upper bound (default == memSize)
  overrideHost?: HostDispatcher; // custom host dispatcher
  env?: HostEnvInterface; // host environment interface
  memInit?: Uint8Array;  // initial memory state 

  registers?: bigint[]; 
  mapPlan?: MapPlanEntry[]; // custom memory mapping plan

  strictVm?: boolean; // default true
}

const ExitReasonTypeName = [
  "Continue", "Halt", "Panic", "OutOfGas", "PageFault", "HostCall",
] as const;


function stringifyExit(e?: ExitReason): string {
  if (!e) return "undefined";
  const t = ExitReasonTypeName[e.type] ?? String(e.type);
  const d = e.detail !== undefined ? ` detail=${String(e.detail)}` : "";
  const id = e.id !== undefined ? ` id=${e.id.toString()}` : "";
  return `${t}${d}${id}`;
}

export function runBlob(blob: Uint8Array, initialGas: Gas, opts: RunBlobOpts = {}) {
  console.log("runBlob");
  const strictVm = opts.strictVm ?? true;


  // const parts = (() => { try { return parseProgramContainer(blob); } catch { return null; } })();
  // const innerBlob = parts?.code ?? blob;

  
  const { jumpTable, jumpEntryLength, jumpEntries, instructionData, opcodeBitmask } = deblob(blob);
  console.log("runBlob bitmask bits, bitmask" ,{ opcodeBitmask});

  const env  = opts.env ?? makeHostEnv();
  const host: HostDispatcher = opts.overrideHost ?? dispatchHostCall;
  const opcodeBits = bitmaskToBoolean(opcodeBitmask, instructionData.length);

  const MEM_SIZE   = opts.memSize   ?? 1024 * 1024;  // 1 MiB default
  const HEAP_START = opts.heapStart ?? 0x10000;      // 64 KiB offset
  const HEAP_END   = opts.heapEnd   ?? MEM_SIZE;     // top of RAM
  const PAGES    = MEM_SIZE / PAGE_SIZE;

  const pageTable = createPageTable(PAGES);
  const IO_BASE_PAGE   = IO_BASE >>> 16;             // 0xFEFE
  const IO_PAGE_COUNT  = IO_SIZE >>> 16;             // 0x00020000 >> 16 = 2 pages
  mapPages(pageTable, IO_BASE_PAGE, IO_BASE_PAGE + IO_PAGE_COUNT, {
    read: true,
    write: true,
  });
  // program bytes (instructionData)

  if (opts.mapPlan?.length) {
    for (const { from, to, read, write } of opts.mapPlan) {
      mapPages(pageTable, from, to, { read, write });
    }
  } else {
    const codePages = (instructionData.length + PAGE_SIZE - 1) >>> 16;
    mapPages(pageTable, 0, codePages, { read: true, write: false });

    const heapStartPage = HEAP_START >>> 16;
    const heapEndPage   = HEAP_END   >>> 16;
    mapPages(pageTable, heapStartPage, heapEndPage + 1, { read: true, write: true });
  }

    // --- HIGH BANDS (args + stack) -------------------------------------------
  // map *inclusive* of the last byte (mapPages end is exclusive)
  const stackSize   = Math.max(0, STACK_TOP - STACK_START);
  const stackPStart = STACK_START >>> 16;
  const stackPEnd   = (STACK_TOP - 1) >>> 16;   // last page touched
  if (stackSize > 0) {
    mapPages(pageTable, stackPStart, stackPEnd + 1, { read: true, write: true });
  }

  const argsLen     = ZI;                       // spec A.7 input zone
  const argsPStart  = ARGS_BASE >>> 16;
  const argsPEnd    = (ARGS_BASE + argsLen - 1) >>> 16;
  mapPages(pageTable, argsPStart, argsPEnd + 1, { read: true, write: false });



  let state: InterpreterState = {
    code: instructionData,
    opcodeMaskBits: opcodeBits,
    pc: 0,
    gas: initialGas,
    registers: opts.registers ?? Array(13).fill(0n),     
    memory: opts.memInit ? Uint8Array.from(opts.memInit) : new Uint8Array(MEM_SIZE),
    exit: { type: ExitReasonType.Continue },
    context: {
      jumpTable: Array.from(jumpTable),
      jumpEntryLength,
      jumpEntries: jumpEntries.map((entry: Uint8Array) => decodeEntry(entry)),
      basicBlockStarts: computeBasicBlockStarts(instructionData, opcodeBits),

      heapStart: HEAP_START,
      heapPointer: HEAP_START,
      heapEnd: HEAP_END,
      pageTable: pageTable,

      argsBase: ARGS_BASE,
      argsBand: new Uint8Array(argsLen),

      stackStart: STACK_START,
      stackBand: new Uint8Array(STACK_SIZE),
      stackTop: STACK_TOP,
    },
  };
  
  if (STACK_TOP <= STACK_START) {
    console.warn("[runBlob] STACK_TOP <= STACK_START; stackBand disabled");
  }
  if (argsLen <= 0) {
    console.warn("[runBlob] argsLen <= 0; argsBand disabled");
  }


  // Execution loop
  while (state.exit?.type === ExitReasonType.Continue && state.gas > 0n) {
    state = executeSingleStep(state);


    

    // console.log("here is state after step");

    if (state.exit?.type === ExitReasonType.HostCall) {
      // console.log("[run] Host call detected, dispatching...", String(state.exit.id)); 
   
   
      state = host(state, env);
      // console.log("[run] after dispatch: exit=", ExitReasonType[state.exit?.type ?? 0], "pc=", state.pc);
      continue;
    }
  }
  
  // If gas hit zero but exit never flipped, normalize to OutOfGas.
  if (state.gas === 0n && state.exit?.type === ExitReasonType.Continue) {
    state.exit = { type: ExitReasonType.OutOfGas };
  }

  if (process.env.JAM_DEBUG_ACC === "1") {
    console.log("[runBlob] strictVm =", strictVm);
  }

  if (strictVm) {
    const t = state.exit?.type;
    const d = state.exit?.detail;
  
    const isIoPageFault =
      t === ExitReasonType.PageFault &&
      (d === 0xFEFE || d === 0xFEFF);
  
    // Panic is always fatal.
    if (t === ExitReasonType.Panic) {
      const msg = `[PVM] Panic exit: ${stringifyExit(state.exit)} (pc=${state.pc})`;
      throw new Error(msg);
    }
  
    // For strictVm, everything except Halt and the IO PageFaults is considered an error.
    if (!isIoPageFault && t !== ExitReasonType.Halt) {
      const msg = `[PVM] Non-halt exit: ${stringifyExit(state.exit)} (pc=${state.pc})`;
      throw new Error(msg);
    }
  }

  console.log("VM execution stopped due to:", ExitReasonType[state.exit!.type],
    state.exit?.detail ? `(${state.exit.detail})` : "");
  console.log("[pvm] initialGas", initialGas.toString());
  console.log("[pvm] finalGas", state.gas.toString());
  
  return state;
}
  

function decodeEntry(entry: Uint8Array): number {
  let result = 0;
  for (let i = 0; i < entry.length; i++) {
    result |= entry[i] << (8 * i); // LE
  }
  return result;
}
  