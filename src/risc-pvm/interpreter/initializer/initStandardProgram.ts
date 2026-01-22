import { withinBudget } from "./helpers";
import { initRegisters } from "./initRegisters";
import { layoutMemory } from "./layoutMemory";
import { parseProgramContainer } from "./parseProgamContainer";
import { StandardInitResult } from "./types";
import { decodeProtocolInt } from "../../../codecs";

// A.37
export const initializeStandardProgram = (
  container: Uint8Array,
  args: Uint8Array,
  memSize: number
): StandardInitResult => {
  const parts = parseProgramContainer(container);
  if (!parts) throw new Error("Y(p,a): not a standard program container");
  if (!withinBudget(parts)) throw new Error("Y(p,a): violates A.41 memory budget");

  const mem = layoutMemory(parts, memSize) // A.42

  // Extract (slot, service_id, item_count) from args E(slot, service_id, item_count)
  // The args are variable-length encoded per C.5
  let sdkArgs: { slot?: number; serviceId?: number; itemCount?: number } | undefined;
  if (args.length > 0) {
    try {
      let off = 0;
      const slotDec = decodeProtocolInt(args.slice(off)); off += slotDec.bytesRead;
      const sidDec = decodeProtocolInt(args.slice(off)); off += sidDec.bytesRead;
      const countDec = decodeProtocolInt(args.slice(off));
      sdkArgs = { slot: slotDec.value, serviceId: sidDec.value, itemCount: countDec.value };
      if (process.env.JAM_DEBUG_REGS === "1") {
        console.log(`[initStandardProgram] Decoded args: slot=${sdkArgs.slot} sid=${sdkArgs.serviceId} itemCount=${sdkArgs.itemCount}`);
      }
    } catch (e) {
      // If decode fails, leave sdkArgs undefined (will use A.43 default)
      if (process.env.JAM_DEBUG_REGS === "1") {
        console.log(`[initStandardProgram] Failed to decode args, using A.43 default`);
      }
    }
  }

  const regs = initRegisters(args.length, undefined, sdkArgs) // A.43 + SDK convention


  if (process.env.JAM_DEBUG_REGS === "1") {
    console.log(`[initStandardProgram] Using A.43 r7=0x${regs[7].toString(16)} (not heapStart=${mem.heapStart})`);
  }

  const { code, reservePages, stackSizeBytes, readOnly, readWrite } = parts;
  return {
    code, // inner blob
    registers: regs,
    ...mem,
    reservePages,
    stackSizeBytes,
    readOnlyLen: readOnly.length,
    readWriteLen: readWrite.length,
  };
}
