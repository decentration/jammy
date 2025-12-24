import { describe, it, expect } from "bun:test";
import path from "node:path";
import {compareNdjson } from "../../../helpers/compareNdjson"

describe("conformance: blob-a divergence", () => {
  it("reports the first differing trace row", () => {
    const ours = path.join("traces", "blob-a.ndjson");
    const theirs = path.join("vectors", "blob-a.reference.ndjson");
    const diff = compareNdjson(ours, theirs);
    if (diff) {
      console.error("FPoD at row", diff.index, "\nOurs:", diff.ours, "\nTheirs:", diff.theirs);
    }
    expect(diff).toBeNull(); // pass only when no diff
  });
});