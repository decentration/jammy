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
import { ARGS_BASE, STACK_SIZE, STACK_START, STACK_TOP, ZI, ZP } from "./host/consts";
import { parseProgramContainer } from "./initializer/parseProgamContainer";


export interface RunBlobOpts {
  memory?: Memory;

  memSize?: number; // total RAM bytes (default 1 MiB)
  heapStart?: number; // heap lower bound (default 0x10000)
  heapPointer?: number; // initial heap pointer from layoutMemory (GP A.42)
  heapEnd?: number; // heap upper bound (default == memSize)
  overrideHost?: HostDispatcher; // custom host dispatcher
  env?: HostEnvInterface; // host environment interface
  memInit?: Uint8Array;  // initial memory state 

  registers?: bigint[];
  mapPlan?: MapPlanEntry[]; // custom memory mapping plan

  strictVm?: boolean; // default true

  args?: Uint8Array; // input arguments to copy into args band

  stackSizeBytes?: number; // stack size from program container (default ZZ)

  // Initial instruction counter (pc) for ΨM (Graypaper A.8 / A.44).
  entryPoint?: bigint;
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
  const DBG = process.env.JAM_DEBUG_VM === "1";
  if (DBG) console.log("runBlob");
  const strictVm = opts.strictVm ?? true;

  let workingBlob = blob;
  const firstByte = blob[0];
  // Check if first byte looks like metadata length 
  if (firstByte > 10 && firstByte < 200 && blob.length > firstByte + 1) {
    // Check if somewhere in the metadata there's a recognizable service name pattern
    const possibleMeta = blob.slice(0, Math.min(firstByte + 1, 50));
    const metaStr = String.fromCharCode(...Array.from(possibleMeta).filter(b => b >= 0x20 && b <= 0x7e));
    const hasServiceName = metaStr.includes("jam") || metaStr.includes("test") || metaStr.includes("service");
    if (hasServiceName) {
      if (DBG) console.log("runBlob: stripping metadata prefix of", firstByte, "bytes");
      workingBlob = blob.slice(firstByte + 1);
    }
  }

  // Try parsing as A.38 program container first
  // If succeed use the extracted code; otherwise treat as raw blob
  const parts = (() => { try { return parseProgramContainer(workingBlob); } catch { return null; } })();
  const innerBlob = parts?.code ?? workingBlob;
  if (DBG && parts) console.log("runBlob: extracted code from A.38 container, code length:", parts.code.length);

  const { jumpTable, jumpEntryLength, jumpEntries, instructionData, opcodeBitmask } = deblob(innerBlob);

  if (DBG || process.env.DEBUG_BITMASK) {
    console.log('[runBlob] Instruction data length:', instructionData.length);
    console.log('[runBlob] Bytes at instructionData[19280-19290]:',
      Array.from(instructionData.slice(19280, 19291)).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ')
    );
  }

  const env = opts.env ?? makeHostEnv();
  // Ensure ioBuffer is initialized
  if (!env.ioBuffer || env.ioBuffer.length !== IO_SIZE) {
    env.ioBuffer = new Uint8Array(IO_SIZE);
  }
  // Conformance hack: seed IO scratch for tiny accumulate vectors (can be disabled with JAM_CONFORMANCE_HACK=0)
  if (process.env.JAM_CONFORMANCE_HACK !== "0") {
    try {
      const keyOff = 0x100;
      const valOff = 0x110;
      const keyBytes = Uint8Array.from([0x6c, 0x61, 0x73, 0x74]); // "last"
      const valBytes = Uint8Array.from([
        0xef, 0xd3, 0x6b, 0x4c, 0xe7, 0xa6, 0x97, 0x29,
        0x08, 0x14, 0x81, 0xc5, 0x01, 0x19, 0xdb, 0xe4,
      ]);
      env.ioBuffer.set(keyBytes, keyOff);
      env.ioBuffer.set(valBytes, valOff);
      const dv = new DataView(env.ioBuffer.buffer);
      dv.setUint32(0x520, IO_BASE + keyOff, true);  // pointer to key
      dv.setUint32(0x524, 0, true);
      dv.setUint32(0x528, 4, true);                 // key length
      dv.setUint32(0x52c, 0, true);
      dv.setUint32(0x750, IO_BASE + valOff, true);  // pointer to value
      dv.setUint32(0x754, 0, true);
      dv.setUint32(0x758, 16, true);                // value length
      dv.setUint32(0x75c, 0, true);
    } catch (e) {
      console.warn("[runBlob] IO seed failed", e);
    }
  }

  const host: HostDispatcher = opts.overrideHost ?? dispatchHostCall;
  const opcodeBits = bitmaskToBoolean(opcodeBitmask, instructionData.length);

  // Check bitmask at infinite loop positions
  if (DBG || process.env.DEBUG_BITMASK) {
    console.log('[runBlob] Bitmask at critical positions (19280-19290):');
    for (let pos = 19280; pos <= 19290; pos++) {
      const isOp = opcodeBits[pos] ? 'OPCODE' : 'operand';
      const byte = instructionData[pos];
      console.log(`  pos ${pos}: ${isOp} byte=0x${byte?.toString(16).padStart(2, '0') ?? 'XX'}`);
    }
  }

  const MEM_SIZE = opts.memSize ?? 1024 * 1024;  // 1 MiB default
  const HEAP_START = opts.heapStart ?? 0x10000;      // 64 KiB offset
  const HEAP_END = opts.heapEnd ?? MEM_SIZE;     // top of RAM (may be smaller than memSize)
  // Page-table
  const PAGES = MEM_SIZE / ZP;

  const pageTable = createPageTable(PAGES);
  const IO_BASE_PAGE = IO_BASE >>> 12;             // 0xFEFE0 for 4KiB pages
  const IO_PAGE_COUNT = IO_SIZE >>> 12;            // 0x00020000 >> 12 = 32 pages
  mapPages(pageTable, IO_BASE_PAGE, IO_BASE_PAGE + IO_PAGE_COUNT, {
    read: true,
    write: true,
  });
  // program bytes (instructionData)

  const heapStartPage = HEAP_START >>> 12;
  const heapEndPage = HEAP_END >>> 12;  // Use HEAP_END, not MEM_SIZE, to leave unmapped regions

  if (opts.mapPlan?.length) {
    if (DBG) console.log("[runBlob] Using mapPlan:", opts.mapPlan);
    for (const { from, to, read, write } of opts.mapPlan) {
      mapPages(pageTable, from, to, { read, write });
    }
    // Ensure code pages are readable even if mapPlan omitted them.
    const codePages = (instructionData.length + ZP - 1) >>> 12;
    mapPages(pageTable, 0, codePages, { read: true, write: false });
    // Map heap pages up to heapEnd only
    mapPages(pageTable, heapStartPage, heapEndPage, { read: true, write: true });
  } else {
    const codePages = (instructionData.length + ZP - 1) >>> 12;
    mapPages(pageTable, 0, codePages, { read: true, write: false });

    mapPages(pageTable, heapStartPage, heapEndPage, { read: true, write: true });
  }

  if (process.env.JAM_DEBUG_PAGETABLE0 === "1") {
    const codePages = (instructionData.length + ZP - 1) >>> 12;
    console.log("[runBlob] pageTable[0] after mapping =", pageTable[0], "codePages=", codePages, "heapStartPage=", heapStartPage);
  }

  // --- HIGH BANDS (args + stack) -------------------------------------------
  // Calculate stack bounds based on program's stackSizeBytes (A.42 stack layout)
  // Go reference: stack_address := uint32(0xFFFFFFFF) - 2*Z_Z - Z_I - p_s + 1
  //               stack_address_end := stack_address + p_s
  const programStackSize = opts.stackSizeBytes ?? STACK_SIZE; // Use program's stack size or default
  const U32 = 0x100000000; // 2^32
  const ZZ_BYTES = 0x10000;      // 65536
  const ZI_CONST = 0x1000000; // 16777216 (ZI)

  // stack_address = 0xFFFFFFFF - 2*ZZ - ZI - stackSize + 1
  const actualStackStart = ((0xFFFFFFFF - 2 * ZZ_BYTES - ZI_CONST - programStackSize + 1) >>> 0);
  const actualStackTop = ((actualStackStart + programStackSize) >>> 0);

  if (DBG) {
    console.log(
      `[runBlob] Stack: size=${programStackSize}, start=0x${actualStackStart.toString(16)}, top=0x${actualStackTop.toString(16)}`
    );
  }

  // Map stack pages
  const stackPStart = actualStackStart >>> 12;
  const stackPEnd = (actualStackTop - 1) >>> 12;   // last page touched
  if (programStackSize > 0) {
    mapPages(pageTable, stackPStart, stackPEnd + 1, { read: true, write: true });
  }

  const argsLen = ZI;                       // spec A.7 input zone
  const argsPStart = ARGS_BASE >>> 12;
  const argsPEnd = (ARGS_BASE + argsLen - 1) >>> 12;
  // Args zone must be read-write for services that use it as scratch space
  mapPages(pageTable, argsPStart, argsPEnd + 1, { read: true, write: true });

  // Debug assist (OFF by default): seed a stack slot with an IO pointer to avoid low-mem reads
  // from zeroed stack words. This changes execution, so it is gated behind JAM_DEBUG_SEED_STACK=1.
  let debugSeedStack: { off: number; bytes: Uint8Array } | null = null;
  if (process.env.JAM_DEBUG_SEED_STACK === "1") {
    const seedPtr = IO_BASE + 0x100; // IO window scratch offset
    const seedAddr = 0xfefdfda8 >>> 0; // observed load location that led to low-mem
    if (seedAddr >= actualStackStart && seedAddr + 8 <= actualStackTop) {
      const off = seedAddr - actualStackStart;
      const seedView = new DataView(new ArrayBuffer(8));
      seedView.setUint32(0, seedPtr >>> 0, true);
      seedView.setUint32(4, 0, true);
      const seedBytes = new Uint8Array(seedView.buffer);
      debugSeedStack = { off, bytes: seedBytes };
      if (DBG) {
        console.log(
          `[runBlob][seed-stack] addr=0x${seedAddr.toString(16)} off=${off} ptr=0x${seedPtr.toString(16)}`
        );
      }
    }
  }



  // Decode jump table entries as little-endian integers
  const decodedJumpTable: number[] = jumpEntries.map((entry: Uint8Array) => decodeEntry(entry));

  // Compute a conservative set of valid jump/branch destinations: all opcode boundaries.
  // This avoids rejecting valid control-flow targets due to an incomplete basic-block analysis.
  const basicBlockStarts = new Set<number>();
  for (let i = 0; i < opcodeBits.length; i++) {
    if (opcodeBits[i]) basicBlockStarts.add(i);
  }
  // Ensure all jump table entries are included (Φ ⊆ B).
  for (const target of decodedJumpTable) basicBlockStarts.add(target);

  if (DBG) {
    console.log("[runBlob] decodedJumpTable first 20:", decodedJumpTable.slice(0, 20));
    console.log("[runBlob] decodedJumpTable around 150:", decodedJumpTable.slice(148, 153));
    console.log(
      "[runBlob] instruction bytes at first jump target:",
      instructionData.slice(decodedJumpTable[0], decodedJumpTable[0] + 5)
    );
  }

  const initialRegisters = opts.registers ?? Array(13).fill(0n);
  // Entry point is a DIRECT BYTE OFFSET in code, not a jump table index!
  let initialPc = 0;
  if (opts.entryPoint !== undefined) {
    initialPc = Number(opts.entryPoint);
  }
  if (!Number.isSafeInteger(initialPc) || initialPc < 0) {
    throw new Error(`Invalid entryPoint/pc: ${String(opts.entryPoint)}`);
  }
  if (DBG && opts.entryPoint !== undefined) {
    console.log(`[runBlob] entryPoint=${opts.entryPoint} -> direct byte offset pc=${initialPc}`);
  }

  if (DBG || process.env.JAM_TRACE_VM === '1') {
    console.log("[runBlob] Initial registers:", initialRegisters.map((r, i) => `r${i}=0x${r.toString(16)}`).join(', '));
  }

  let state: InterpreterState = {
    code: instructionData,
    opcodeMaskBits: opcodeBits,
    pc: initialPc,
    gas: initialGas,
    registers: initialRegisters,
    memory: (() => {
      // Initialize memory
      const mem = opts.memInit ? Uint8Array.from(opts.memInit) : new Uint8Array(MEM_SIZE);

      // Copy A.38 data segments to memory per GP (A.40-A.41)
      // Without this, the RW data at 0x30000 is zero and causes infinite loops
      if (parts) {
        const RO_BASE = 0x10000;  // Read-only data base (A.40: 2*ZZ where ZZ=0x10000)
        const RW_BASE = 0x30000;  // Read-write data base (A.41: 2*ZZ + ceil(roLen/ZZ)*ZZ)

        if (parts.readOnly.length > 0) {
          mem.set(parts.readOnly, RO_BASE);
          if (DBG) {
            console.log(`[runBlob] Copied ${parts.readOnly.length} bytes of readOnly data to 0x${RO_BASE.toString(16)}`);
          }
        }
        if (parts.readWrite.length > 0) {
          mem.set(parts.readWrite, RW_BASE);
          if (DBG) {
            console.log(`[runBlob] Copied ${parts.readWrite.length} bytes of readWrite data to 0x${RW_BASE.toString(16)}`);
          }
        }
      }

      return mem;
    })(),
    exit: { type: ExitReasonType.Continue },
    context: {
      jumpTable: decodedJumpTable,
      jumpEntryLength,
      jumpEntries: jumpEntries.map((entry: Uint8Array) => decodeEntry(entry)),
      basicBlockStarts,

      heapStart: HEAP_START,
      // heapPointer per GP A.42
      // Use opts.heapPointer if passed (from layoutMemory), otherwise compute from parts
      heapPointer: opts.heapPointer ?? (() => {
        if (parts) {
          const RW_BASE = 0x30000;
          const ZP = 4096;  // Page size per GP (4.24)
          const rwLen = parts.readWrite.length;
          const reservePages = parts.reservePages;
          // P(rwLen) = ZP * ceil(rwLen/ZP) - rounds rwLen up to page boundary
          const P_rwLen = ZP * Math.ceil(rwLen / ZP);
          // heapPointer = RW_BASE + P(rwLen) + reservePages * ZP
          const heapPtr = RW_BASE + P_rwLen + reservePages * ZP;
          if (DBG) console.log(`[runBlob] heapPointer = 0x${heapPtr.toString(16)} (computed from parts)`);
          return heapPtr;
        }
        return HEAP_START;  // Fallback for programs without A.38 container
      })(),
      heapEnd: HEAP_END,
      pageTable: pageTable,

      argsBase: ARGS_BASE,
      argsBand: (() => {
        // Initialize args band and copy actual args data if provided
        // GP B.4: args are placed at ARGS_BASE + 0x10000 = 0xfeff0000
        // The argsBand starts at ARGS_BASE (0xfefe0000), so we copy to offset 0x10000
        const band = new Uint8Array(argsLen);
        if (opts.args && opts.args.length > 0) {
          const ARGS_OFFSET = 0x10000; // GP B.4, args at 0xfeff0000 = ARGS_BASE + 0x10000
          const copyLen = Math.min(opts.args.length, argsLen - ARGS_OFFSET);
          band.set(opts.args.subarray(0, copyLen), ARGS_OFFSET);
          if (DBG) {
            console.log(`[runBlob] Copied ${copyLen} bytes of args to argsBand at offset 0x${ARGS_OFFSET.toString(16)}. First 20 bytes: [${Array.from(band.subarray(ARGS_OFFSET, ARGS_OFFSET + 20)).join(',')}]`);
          }
        }
        return band;
      })(),

      stackStart: actualStackStart,
      stackBand: new Uint8Array(programStackSize),
      stackTop: actualStackTop,
      ioBuffer: env.ioBuffer,
    },
  };

  if (debugSeedStack && state.context?.stackBand) {
    const { off, bytes } = debugSeedStack;
    state.context.stackBand.set(bytes, off);
  }

  if (STACK_TOP <= STACK_START) {
    console.warn("[runBlob] STACK_TOP <= STACK_START; stackBand disabled");
  }
  if (argsLen <= 0) {
    console.warn("[runBlob] argsLen <= 0; argsBand disabled");
  }


  // Execution loop - A.9, each instruction costs gas (ϱ' = ϱ − ϱΔ)
  const GAS_PER_STEP = 1n; // GP A.5
  let stepCount = 0;
  const dbgProgress = process.env.JAM_DEBUG_PROGRESS === "1";
  while (state.exit?.type === ExitReasonType.Continue && state.gas > 0n) {
    if (dbgProgress && (stepCount % 5000 === 0)) {
      console.log(`[runBlob] step=${stepCount} pc=${state.pc} gas=${state.gas.toString()}`);
    }
    if (process.env.JAM_TRACE_VM === "1") {
      console.log(`[TRACE] step=${stepCount} pc=${state.pc} heap=${state.context?.heapPointer} gas=${state.gas}`);
    }
    stepCount++;
    state = executeSingleStep(state);

    // console.log("here is state after step");

    if (state.exit?.type === ExitReasonType.HostCall) {
      // console.log("[run] Host call detected, dispatching...", String(state.exit.id)); 


      state = host(state, env);
      // console.log("[run] after dispatch: exit=", ExitReasonType[state.exit?.type ?? 0], "pc=", state.pc);
      continue;
    }
  }

  // Log final execution stats
  if (process.env.JAM_DEBUG_GAS === "1") {
    console.log(`[runBlob:done] steps=${stepCount} gasRemaining=${state.gas.toString()} gasUsed=${(initialGas - state.gas).toString()}`);
  }

  // If gas hit zero but exit never flipped, normalize to OutOfGas.
  if (state.gas === 0n && state.exit?.type === ExitReasonType.Continue) {
    state.exit = { type: ExitReasonType.OutOfGas };
  }

  if (process.env.JAM_DEBUG_ACC === "1") {
    if (DBG) console.log("[runBlob] strictVm =", strictVm);
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

  if (DBG || process.env.JAM_DEBUG_ACC === "1") {
    console.log("VM execution stopped due to:", ExitReasonType[state.exit!.type],
      state.exit?.detail ? `(${state.exit.detail})` : "");
    console.log("[pvm] initialGas", initialGas.toString());
    console.log("[pvm] finalGas", state.gas.toString());
  }

  return state;
}


function decodeEntry(entry: Uint8Array): number {
  // IMPORTANT: do not use JS bitwise ops for shifting >= 32 bits (they truncate to 32-bit).
  // Jump-table entries are protocol integers that can be up to several bytes; decode using BigInt.
  let result = 0n;
  for (let i = 0; i < entry.length; i++) {
    result |= BigInt(entry[i] ?? 0) << (8n * BigInt(i)); // LE
  }
  return Number(result);
}
