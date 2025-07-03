import { computeBasicBlockStarts } from "./computeBasicBlockStarts";
import { deblob } from "./deblob";
import { executeSingleStep } from "./executeSingleStep";
import { InterpreterState, ExitReasonType } from "./types";
import { bitmaskToBoolean } from "./utils/bitmask";

export async function runBlob(blob: Uint8Array, initialGas: number) {
    const { jumpTable, jumpEntryLength, jumpEntries, instructionData, opcodeBitmask } = deblob(blob);
    console.log("runBlob bitmask bits, bitmask" ,{ opcodeBitmask});

    const opcodeBits = bitmaskToBoolean(opcodeBitmask, instructionData.length);

    let state: InterpreterState = {
      code: instructionData,
      opcodeMaskBits: opcodeBits,
      pc: 0,
      gas: initialGas,
      registers: Array(13).fill(0n),
      memory: new Uint8Array(1024 * 1024), // 1mb memory
      exit: { type: ExitReasonType.Continue },
      context: {
        jumpTable: Array.from(jumpTable),
        jumpEntryLength,
        jumpEntries: jumpEntries.map((entry: Uint8Array) => decodeEntry(entry)),
        basicBlockStarts: computeBasicBlockStarts(instructionData, opcodeBits),
        heapStart: 0x10000,
        heapPointer: 0x10000,
      },
    };
  
    while (state.exit?.type === ExitReasonType.Continue && state.gas > 0) {
      state = executeSingleStep(state);
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
  