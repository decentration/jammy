import fs from "node:fs";
import path from "node:path";
import { deblob } from "../../risc-pvm/interpreter/deblob";
import { executeProgram } from "../../risc-pvm/interpreter/host/execute/executeService";
import { getServiceProgramFromState } from "../../stf/loaders";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../consts";
import { prepareProgram } from "../../risc-pvm/interpreter/host/prepareProgram";

const VEC_PATH = path.join(JAM_TEST_VECTORS, "stf/accumulate/", CHAIN_TYPE, "/accumulate_ready_queued_reports-1.json");

describe("deblob on vector-provided program blob", () => {
  it("extracts code (unwrap) and deblobs it", () => {
    const raw = JSON.parse(fs.readFileSync(VEC_PATH, "utf8"));
    const { blob } = getServiceProgramFromState(raw.pre_state, 1729);

    const prepared = prepareProgram(blob, 1 << 20)
    const innerBlob = prepared.init.code
    const out = deblob(innerBlob);  // A.2 parser 
    expect([1, 2, 3, 4]).toContain(out.jumpEntryLength);
    expect(out.jumpTable.length).toBe(out.jumpEntries.length * out.jumpEntryLength);
    expect(out.opcodeBitmask.length).toBe(Math.ceil(out.instructionData.length / 8));
  });
});

describe("executeProgram on vector-provided program blob", () => {
  it("runs a wrapped program blob end-to-end", () => {
    const raw = JSON.parse(fs.readFileSync(VEC_PATH, "utf8"));
    const { codeHash, blob } = getServiceProgramFromState(raw.pre_state, 1729);

    const vmState = executeProgram({
      codeHash,
      programBlob: blob,
      initialGas: 50_000n,
    });

    expect(vmState.exit?.type).not.toBeUndefined();
  })
});
