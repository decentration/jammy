import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { StateCodec } from "../../../stf/assurances/codecs/StateCodec/StateCodec";
import { toHex, convertToReadableFormat } from "../../../utils";

describe("StateCodec test", () => {
    it("encodes/decodes pre_state data from JSON", () => {
      const jsonPath = path.resolve(__dirname, "../../../stf/assurances/data/pre_state-1.json");
      const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
  
      const preState = {
        avail_assignments: raw.avail_assignments.map((assignment: any) => {
          if (!assignment) {
            return null; // Handle null or undefined assignments
          }
          return {
            report: assignment.report
              ? {
                  package_spec: {
                    hash: Uint8Array.from(Buffer.from(assignment.report.package_spec.hash.slice(2), "hex")),
                    length: assignment.report.package_spec.length,
                    erasure_root: Uint8Array.from(
                      Buffer.from(assignment.report.package_spec.erasure_root.slice(2), "hex")
                    ),
                    exports_root: Uint8Array.from(
                      Buffer.from(assignment.report.package_spec.exports_root.slice(2), "hex")
                    ),
                    exports_count: assignment.report.package_spec.exports_count,
                  },
                  context: {
                    anchor: Uint8Array.from(Buffer.from(assignment.report.context.anchor.slice(2), "hex")),
                    state_root: Uint8Array.from(
                      Buffer.from(assignment.report.context.state_root.slice(2), "hex")
                    ),
                    beefy_root: Uint8Array.from(
                      Buffer.from(assignment.report.context.beefy_root.slice(2), "hex")
                    ),
                    lookup_anchor: Uint8Array.from(
                      Buffer.from(assignment.report.context.lookup_anchor.slice(2), "hex")
                    ),
                    lookup_anchor_slot: assignment.report.context.lookup_anchor_slot,
                    prerequisites: assignment.report.context.prerequisites.map((p: any) =>
                      Uint8Array.from(Buffer.from(p.slice(2), "hex"))
                    ),
                  },
                  core_index: assignment.report.core_index,
                  authorizer_hash: Uint8Array.from(
                    Buffer.from(assignment.report.authorizer_hash.slice(2), "hex")
                  ),
                  auth_output: Uint8Array.from(Buffer.from(assignment.report.auth_output.slice(2), "hex")),
                  segment_root_lookup: assignment.report.segment_root_lookup.map((s: any) =>
                    Uint8Array.from(Buffer.from(s.slice(2), "hex"))
                  ),
                  results: assignment.report.results.map((r: any) => ({
                    service_id: r.service_id,
                    code_hash: Uint8Array.from(Buffer.from(r.code_hash.slice(2), "hex")),
                    payload_hash: Uint8Array.from(Buffer.from(r.payload_hash.slice(2), "hex")),
                    accumulate_gas: r.accumulate_gas,
                    result: r.result.ok
                    ? { ok: Uint8Array.from(Buffer.from(r.result.ok.slice(2), "hex")) }
                    : { panic: null },
                 })),
               
                }
              : null,
            timeout: assignment.timeout,
          };
        }),
        curr_validators: raw.curr_validators.map((validator: any) => ({
          bandersnatch: Uint8Array.from(Buffer.from(validator.bandersnatch.slice(2), "hex")),
          ed25519: Uint8Array.from(Buffer.from(validator.ed25519.slice(2), "hex")),
          bls: Uint8Array.from(Buffer.from(validator.bls.slice(2), "hex")),
          metadata: Uint8Array.from(Buffer.from(validator.metadata.slice(2), "hex")),
        })),
      };
  
      const encoded = StateCodec.enc(preState);
      console.log("Encoded PreAndPostState (hex):", toHex(encoded));
  
      const decoded = StateCodec.dec(encoded);
  
      const readableEncoded = toHex(encoded);
      const readableDecoded = convertToReadableFormat(decoded);
      const readableOriginal = convertToReadableFormat(preState);
  
      const outputDir = path.resolve(__dirname, "../../output/stf/assurances/pre_state");
      writeFileSync(path.join(outputDir, "encodedPreState.txt"), readableEncoded);
      writeFileSync(
        path.join(outputDir, "decodedPreState.json"),
        JSON.stringify(readableDecoded, null, 2)
      );
      writeFileSync(
        path.join(outputDir, "originalPreState.json"),
        JSON.stringify(readableOriginal, null, 2)
      );
  
      expect(decoded).toStrictEqual(preState);
    });
  });
  
  
