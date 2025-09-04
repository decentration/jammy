import { computeBasicBlockStarts } from "./computeBasicBlockStarts";
import { deblob } from "./deblob";
import { executeSingleStep } from "./executeSingleStep";
import { InterpreterState, ExitReasonType, PAGE_SIZE } from "./types";
import { bitmaskToBoolean } from "./utils/bitmask";
import { createPageTable, mapPages } from "./memory";
import { dispatchHostCall } from "./host/hostCallHandlers";
import { HostEnvInterface, makeHostEnv } from "./host/hostEnvInterface";
import { HostDispatcher } from "./host/types";


export interface RunBlobOpts {
  memSize?:   number; // total RAM bytes (default 1 MiB)
  heapStart?: number; // heap lower bound (default 0x10000)
  heapEnd?:   number; // heap upper bound (default == memSize)
  overrideHost?: HostDispatcher; // custom host dispatcher
  env?: HostEnvInterface; // host environment interface
  memInit?: Uint8Array;  // initial memory state 
}

export function runBlob(blob: Uint8Array, initialGas: number, opts: RunBlobOpts = {}) {
  console.log("runBlob", { blob, initialGas, opts });
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

  // program bytes (instructionData)

  // convert bytesToPages 
  const bytesToPages = (instructionData.length + PAGE_SIZE - 1) >>> 16
  mapPages(pageTable, 0, bytesToPages, { read:true, write:false });

  // heap zone => RW
  const heapStartPage = HEAP_START >>> 16;
  const heapEndPage   = HEAP_END   >>> 16;
  mapPages(pageTable, heapStartPage, heapEndPage + 1, { read:true, write:true });


  let state: InterpreterState = {
    code: instructionData,
    opcodeMaskBits: opcodeBits,
    pc: 0,
    gas: initialGas,
    registers: Array(13).fill(0n),
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
      pageTable: pageTable
    },
  };
  

  // Execution loop
  while (state.exit?.type === ExitReasonType.Continue && state.gas > 0) {
    state = executeSingleStep(state);

    console.log("here is state after step");

    if (state.exit?.type === ExitReasonType.HostCall) 
      console.log("[run] Host call detected, dispatching...", String(state.exit.id)); 
   
   
      state = host(state, env);
      console.log("[run] after dispatch: exit=", ExitReasonType[state.exit?.type ?? 0], "pc=", state.pc);
    continue;
  }
  
  console.log("VM execution stopped due to:", ExitReasonType[state.exit!.type], 
      state.exit?.detail ? `(${state.exit.detail})` : "");
  return state;
}
  

function decodeEntry(entry: Uint8Array): number {
  let result = 0;
  for (let i = 0; i < entry.length; i++) {
    result |= entry[i] << (8 * i); // LE
  }
  return result;
}
  