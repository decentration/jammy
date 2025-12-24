import { runBlob } from "../interpreter/runBlob";
import { makeHostEnv } from "../interpreter/host/hostEnvInterface";
import { dispatchHostCall } from "../interpreter/host/hostCallHandlers";
import { ExitReasonType } from "../interpreter/types";
import { withEnvTracing, withHostDispatcherTracing } from "./withHostTracing";
import { Gas } from "../../types";

// Use the same prep path as Accumulate (A.38 unwrap + Y(p,a) init)
import { prepareProgram } from "../interpreter/host/prepareProgram";

export type TraceCfg = {
  initialGas?: Gas;
  maxSteps?: number; // kept for API symmetry; runBlob doesn’t use it directly
  watch: {
    pcs?: bigint[];
    memRanges?: Array<{ start: number; end: number }>;
    hostCalls?: (string | number)[];
  };
  filters?: {
    regs?: ("r0" | "r1" | number)[];
    memWrites?: boolean;
    cf?: boolean;
  };
  onEvent: (e: TraceEvent) => void;
};

export type TraceEvent =
  | { t: "pc"; pc: bigint; opcode: number }
  | { t: "cf"; from: bigint; to: bigint; reason: "jump" | "branch" }
  | { t: "host:enter"; id: number; name?: string }
  | { t: "host:exit"; id: number; name?: string; gasUsed: bigint }
  | { t: "mem:write"; addr: number; len: number }
  | { t: "regs"; pc: bigint; regs: Record<string, bigint> }
  | { t: "exit"; reason: ExitReasonType; gasUsed: bigint };

export function runWithTrace(program: Uint8Array, cfg: TraceCfg) {
  const onEvent = (e: TraceEvent) => cfg.onEvent?.(e);

  // 1) Host env + env-level tracing
  const baseEnv = makeHostEnv();
  const env = withEnvTracing(
    baseEnv,
    (name) => {
      if (!cfg.watch.hostCalls || cfg.watch.hostCalls.includes(name)) {
        onEvent({ t: "host:enter", id: -1, name });
      }
    },
    (name) => {
      if (!cfg.watch.hostCalls || cfg.watch.hostCalls.includes(name)) {
        onEvent({ t: "host:exit", id: -1, name, gasUsed: 0n });
      }
    }
  );

  // 2) Host dispatcher tracing (ΩX calls)
  const tracedDispatcher = withHostDispatcherTracing(
    dispatchHostCall,
    (id, name) => {
      if (
        !cfg.watch.hostCalls ||
        cfg.watch.hostCalls.includes(id) ||
        (name && cfg.watch.hostCalls.includes(name))
      ) {
        onEvent({ t: "host:enter", id, name });
      }
    },
    (id, name, gasUsed) => {
      if (
        !cfg.watch.hostCalls ||
        cfg.watch.hostCalls.includes(id) ||
        (name && cfg.watch.hostCalls.includes(name))
      ) {
        onEvent({ t: "host:exit", id, name, gasUsed });
      }
    },
    /* idToName */ undefined
  );

  // 3) Standard prep (handles A.38 container + Y(p,a) memory/register layout)
  const memSize = 1 << 20;
  const args = new Uint8Array();
  const { init } = prepareProgram(program, memSize, args);
  // init: { code, registers, memInit, heapStart, heapEnd, mapPlan?, argsBand?, argsBase?, stackBand?, stackStart?, stackTop? }

  // 4) Execute inner A.2 code with prepared memory/registers/bands
  const res = runBlob(init.code, (cfg.initialGas ?? 10_000_000_000n) as Gas, {
    env,
    overrideHost: tracedDispatcher,

    // memory model from init
    memSize,
    heapStart: init.heapStart,
    heapEnd: init.heapEnd,
    memInit: init.memInit,
    registers: init.registers,
    mapPlan: (init as any).mapPlan,

    // pass high-band portals so readBytes/writeBytes can route FEFE/stack addresses
    bands: {
      argsBand: (init as any).argsBand,
      argsBase: (init as any).argsBase,
      stackBand: (init as any).stackBand,
      stackStart: (init as any).stackStart,
      stackTop: (init as any).stackTop,
    },
  } as any);

  onEvent({ t: "exit", reason: res.exit!.type, gasUsed: (res as any).gas ?? 0n });
  return res;
}
