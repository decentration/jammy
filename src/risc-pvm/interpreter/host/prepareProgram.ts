import { initializeStandardProgram } from "../initializer/initStandardProgram";
import { parseProgramContainer } from "../initializer/parseProgamContainer";
import { StandardInitResult } from "../initializer/types";
import { BaseInitResult } from "../types";
import { stripManifestHeaderIfPresent } from "./utils";

export type PreparedProgram =
  | { via: "standard"; init: StandardInitResult }
  | { via: "raw";      init: BaseInitResult };

export function prepareProgram(
  programBlob: Uint8Array,
  memSize: number,
  args: Uint8Array = new Uint8Array()
): PreparedProgram {
  const payload = stripManifestHeaderIfPresent(programBlob);
  const parts = parseProgramContainer(payload);
  const DBG = process.env.JAM_DEBUG_VM === "1" || process.env.JAM_DEBUG_ACC === "1";
  if (DBG) console.log("[prepareProgram] parts =", parts ? "standard" : "raw");
  if (parts) {
    const init = initializeStandardProgram(payload, args, memSize);
    if (DBG) console.log("[prepareProgram] standard init mapPlan:", init.mapPlan);
    if (DBG) console.log("[prepareProgram] stackSizeBytes:", init.stackSizeBytes);
    return { via: "standard", init };
  }
  // minimal raw init
  const init: BaseInitResult = {
    code: payload,
    registers: Array(13).fill(0n),
    memInit: new Uint8Array(memSize),
    heapStart: 0,
    heapEnd: memSize,
  };
  return { via: "raw", init };
}
