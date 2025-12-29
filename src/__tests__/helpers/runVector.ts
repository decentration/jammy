import fs from "node:fs";
import path from "node:path";
import { runWithTrace } from "../../risc-pvm/runner/runWithTrace";
import { parseProgramContainer } from "../../risc-pvm/interpreter/initializer/parseProgamContainer";
import { Gas } from "../../types";

export type VectorExpectation = {
  exitReason: number | string;
  gasUsed?: string | number;
  stateRootHex?: string;
  hostJournalHash?: string;
  blob?: string | { file?: string; hex?: string; base64?: string };
};

const hexToU8 = (hex: string) =>
  new Uint8Array(Buffer.from(hex.replace(/^0x/, ""), "hex"));
const b64ToU8 = (b64: string) => new Uint8Array(Buffer.from(b64, "base64"));

const jsonBig = (_k: string, v: unknown) =>
  typeof v === "bigint" ? v.toString() : v;

const bigintReplacer = (_k: string, v: unknown) =>
  typeof v === "bigint" ? v.toString() : v;


function loadProgramBytes(blobPath: string, expected?: VectorExpectation): Uint8Array {

  if (expected?.blob) {
    const b = expected.blob as any;
    if (typeof b === "string") {
      if (b.startsWith("0x")) return hexToU8(b);
      if (/^[A-Za-z0-9+/=]+$/.test(b)) return b64ToU8(b);
      return new Uint8Array(fs.readFileSync(b)); 
    }
    if (b.file)   return new Uint8Array(fs.readFileSync(b.file));
    if (b.hex)    return hexToU8(b.hex);
    if (b.base64) return b64ToU8(b.base64);
    throw new Error("expected.blob: unsupported format");
  }
  // Fallback: read from the .bin on disk
  return new Uint8Array(fs.readFileSync(blobPath));
}

export async function runVector(
  blobPath: string,
  expected?: VectorExpectation,
  cfg?: {
    initialGas?: Gas;
    maxSteps?: number;
    watchHost?: (string | number)[];
    traceOut?: string;
  }
) {

  
  // 1) Load bytes 
  const raw = loadProgramBytes(blobPath, expected);

  // 2) Unwrap A.38 container -> inner A.2 (safe no-op if already raw)
  let program = raw;
  try {
    const parts = parseProgramContainer(raw);
    if (parts?.code) program = parts.code;
  } catch {
    // not a container; keep as-is
  }

  // 3) Collect a clean structured trace
  const rows: any[] = [];

  if (cfg?.traceOut) {
    const outDir = path.dirname(cfg.traceOut);
    fs.mkdirSync(outDir, { recursive: true });
    const stream = fs.createWriteStream(cfg.traceOut, { flags: "w" });
    for (const row of rows) stream.write(JSON.stringify(row, jsonBig) + "\n");
    stream.end();
  }


  const onEvent = (e: any) => { rows.push(e); };

  const res = runWithTrace(program, {
    initialGas: cfg?.initialGas ?? 10_000_000_000n,
    maxSteps: cfg?.maxSteps ?? 50_000_000,
    watch: {
      pcs: [],
      memRanges: [],
      hostCalls: cfg?.watchHost ?? [],
    },
    filters: {
      cf: true,
      memWrites: false,
    },
    onEvent,
  });

  // 4) NDJSON sink
  if (cfg?.traceOut) {
    const outDir = path.dirname(cfg.traceOut);
    fs.mkdirSync(outDir, { recursive: true });
    const stream = fs.createWriteStream(cfg.traceOut, { flags: "w" });
    for (const row of rows) stream.write(JSON.stringify(row, bigintReplacer) + "\n");
    stream.end();
  }

  // 5) Basic summary from the trace
  const exitEvt = rows.findLast(r => r.t === "exit");
  const hostGas = rows
    .filter(r => r.t === "host:exit")
    .reduce((acc: bigint, r: any) => acc + BigInt(r.gasUsed ?? 0), 0n);

  const summary = {
    vmExitReason: exitEvt?.reason,
    vmGasUsed: exitEvt?.gasUsed,
    hostGasUsed: hostGas,
  };

  // 6) expectations
  if (expected) {
    if (expected.exitReason !== undefined &&
        String(summary.vmExitReason) !== String(expected.exitReason)) {
      throw new Error(`Exit reason mismatch: got ${summary.vmExitReason}, expected ${expected.exitReason}`);
    }
    if (expected.gasUsed !== undefined &&
        String(summary.vmGasUsed) !== String(expected.gasUsed)) {
      throw new Error(`Gas mismatch: got ${summary.vmGasUsed}, expected ${expected.gasUsed}`);
    }
  }

  return { rows, summary, res };
}
