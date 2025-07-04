import { computeBasicBlockStarts } from "./computeBasicBlockStarts";
import { deblob } from "./deblob";
import { executeSingleStep } from "./executeSingleStep";
import { InterpreterState, ExitReasonType } from "./types";
import { bitmaskToBoolean } from "./utils/bitmask";


export interface RunBlobOpts {
  memSize?:   number; // total RAM bytes (default 1 MiB)
  heapStart?: number; // heap lower bound (default 0x10000)
  heapEnd?:   number; // heap upper bound (default == memSize)
}

export function runBlob(blob: Uint8Array, initialGas: number, opts: RunBlobOpts = {}) {
    const { jumpTable, jumpEntryLength, jumpEntries, instructionData, opcodeBitmask } = deblob(blob);
    console.log("runBlob bitmask bits, bitmask" ,{ opcodeBitmask});

    const opcodeBits = bitmaskToBoolean(opcodeBitmask, instructionData.length);


    const MEM_SIZE   = opts.memSize   ?? 1024 * 1024;  // 1 MiB default
    const HEAP_START = opts.heapStart ?? 0x10000;      // 64 KiB offset
    const HEAP_END   = opts.heapEnd   ?? MEM_SIZE;     // top of RAM
  

    let state: InterpreterState = {
      code: instructionData,
      opcodeMaskBits: opcodeBits,
      pc: 0,
      gas: initialGas,
      registers: Array(13).fill(0n),
      memory: new Uint8Array(MEM_SIZE), // 1mb memory
      exit: { type: ExitReasonType.Continue },
      context: {
        jumpTable: Array.from(jumpTable),
        jumpEntryLength,
        jumpEntries: jumpEntries.map((entry: Uint8Array) => decodeEntry(entry)),
        basicBlockStarts: computeBasicBlockStarts(instructionData, opcodeBits),
        heapStart: HEAP_START,
        heapPointer: HEAP_START,
        heapEnd: HEAP_END,
      },
    };
  

    // Execution loop
    while (state.exit?.type === ExitReasonType.Continue && state.gas > 0) {
      state = executeSingleStep(state);

      console.log("here is state after step");
      // !TODO: If HostCall then stop, temporary. 
      if (state.exit?.type === ExitReasonType.HostCall) {
      
      console.log("HostCall detected, stopping execution.");
      break};
    }
  
    console.log("VM execution stopped due to:", ExitReasonType[state.exit!.type]);
    return state;
  }
  

  function decodeEntry(entry: Uint8Array): number {
    let result = 0;
    for (let i = 0; i < entry.length; i++) {
      result |= entry[i] << (8 * i); // LE
    }
    return result;
  }
  