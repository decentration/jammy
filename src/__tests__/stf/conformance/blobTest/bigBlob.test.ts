import fs from "node:fs";
import { loadBlob } from "../../../../risc-pvm/loader/loadBlob";
import { runWithTrace } from "../../../../risc-pvm/runner/runWithTrace";


test("conformance: big blob A", async () => {
  const buf = fs.readFileSync("vectors/blob-a.bin");
  const expected = JSON.parse(fs.readFileSync("vectors/blob-a.expected.json","utf8"));
  console.log("expected", expected)
  const { image } = loadBlob(new Uint8Array(buf));

  let gasUsed = 0n, exit: any = null;
  const journal: any[] = [];
  const res = await runWithTrace(image, {
    maxSteps: expected.maxSteps ?? 50_000_000,
    watch: { hostCalls: [] },
    filters: { cf: true, memWrites: false },
    onEvent: e => {
      if (e.t === "host:enter" || e.t === "host:exit") journal.push(e);
      if (e.t === "exit") { gasUsed = e.gasUsed; exit = e.reason; }
    }
  });

  expect(String(gasUsed)).toBe(String(expected.gasUsed));
  expect(exit).toBe(expected.exitReason);
  // If you compute a state root / ledger digest:
  expect(res.stateRootHex).toBe(expected.stateRootHex);
  // And compare host-call I/O:
  expect(JSON.stringify(journal)).toBe(JSON.stringify(expected.journal));
});
