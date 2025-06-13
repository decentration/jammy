import { bitmaskToBoolean } from "./utils/bitmask";
import { ExitReasonType, InterpreterState } from "./types";
import { deblob, DeconstructedBlob } from "./deblob";
import { decodeProtocolInt } from "../../codecs";
import { computeBasicBlockStarts } from "./computeBasicBlockStarts";
import { prettyState } from "./utils/debug";

export function buildState(opts: {
  code: Uint8Array;
  bitmask: Uint8Array;
  initialGas?: number;
  blob?: Uint8Array;
  registers?: bigint[];
}): InterpreterState {

  let jumpTable: number[] = [];
  let jumpEntryLength = 0;
  let instructionData = opts.code;
  let opcodeBitmask = opts.bitmask;
  let jumpEntries: Uint8Array[] = [];

  if (opts.blob) {
    const blobData: DeconstructedBlob = deblob(opts.blob);

    jumpEntries =     blobData.jumpEntries;
    jumpEntryLength =   blobData.jumpEntryLength;
    instructionData = blobData.instructionData;
    opcodeBitmask =   blobData.opcodeBitmask;

    // decode jump entries to numeric addresses
    jumpTable = jumpEntries.map(entry => decodeProtocolInt(entry).value);
  }

  const opcodeMaskBits = bitmaskToBoolean(opcodeBitmask, instructionData.length);
  const basicBlockStarts = computeBasicBlockStarts(instructionData, opcodeMaskBits);

  const defaultRegisters = Array(13).fill(0n);

  const state: InterpreterState = {
    // if blob doesnt exist, use code as instruction data
    code: instructionData,
    opcodeMaskBits,
    pc: 0,
    gas: opts.initialGas ?? 10_000,
    registers: opts.registers ?? defaultRegisters,    
    memory: new Uint8Array(2 ** 18),
    exit: { type: ExitReasonType.Continue },
    context: {
      jumpTable,
      jumpEntryLength,
      basicBlockStarts: new Set(basicBlockStarts), // convert to Set for fast lookup
    },
  };

  return state;
}
