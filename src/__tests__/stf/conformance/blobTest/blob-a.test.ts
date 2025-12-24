import { describe, it, expect } from "bun:test";
import path from "node:path";
import fs from "node:fs";
import { runVector } from "../../../helpers/runVector"

const VECTORS_DIR = "src/__tests__/stf/conformance/blobTest/vectors"

describe("conformance: blob-a", () => {
  it("runs the large program and matches key expectations", async () => {
    const blobPath = path.join(VECTORS_DIR, "blob-a.bin");
    const expectedPath = path.join(VECTORS_DIR, "blob-a.expected.json");

    const expected = fs.existsSync(expectedPath)
      ? JSON.parse(fs.readFileSync(expectedPath, "utf8"))
      : undefined;

      console.log("expected", expected)

    const traceOut = process.env.TRACE_OUT
      ? path.join(process.env.TRACE_OUT, "blob-a.ndjson")
      : undefined;

    const { summary } = await runVector(blobPath, expected, {
      initialGas: 10_000_000_000n,
      maxSteps: 100_000_000,
      watchHost: [],           // [] = trace all host calls; or ["Ωfetch", 3] to filter
      traceOut,
    });

    // Minimal asserts even if expected file is absent
    expect(summary.vmExitReason).toBeDefined();
    expect(typeof summary.vmGasUsed === "bigint" || typeof summary.vmGasUsed === "number").toBeTruthy();
  });
});
