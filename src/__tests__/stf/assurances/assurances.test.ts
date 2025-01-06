import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Assurances } from "../../../stf/assurances/types";
import { AssurancesCodec } from "../../../stf/assurances/codecs/AssurancesCodec";
import { toHex, convertToReadableFormat } from "../../../utils";
import { ErrorCode } from "../../../stf/types";

describe("AssurancesCodec Test", () => {
  it("should encode and decode Assurances correctly", () => {
    // Load test data from JSON
    const jsonPath = path.resolve(__dirname, "../../../stf/assurances/data/assurance_for_not_engaged_core-1.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // Map JSON data to Assurances interface
    const assurances: Assurances = {
      input: {
        assurances: raw.input.assurances.map((ass: any) => ({
          anchor: Uint8Array.from(Buffer.from(ass.anchor.slice(2), "hex")),
          bitfield: Uint8Array.from(Buffer.from(ass.bitfield.slice(2), "hex")),
          validator_index: ass.validator_index,
          signature: Uint8Array.from(Buffer.from(ass.signature.slice(2), "hex")),
        })),
        slot: raw.input.slot,
        parent: Uint8Array.from(Buffer.from(raw.input.parent.slice(2), "hex")),
      },
      pre_state: {
        avail_assignments: raw.pre_state.avail_assignments.map((assignment: any) => {
          if (!assignment) {
            return null;
          }
          return {
            report: {
              package_spec: {
                hash: Uint8Array.from(Buffer.from(assignment.report.package_spec.hash.slice(2), "hex")),
                length: assignment.report.package_spec.length,
                erasure_root: Uint8Array.from(Buffer.from(assignment.report.package_spec.erasure_root.slice(2), "hex")),
                exports_root: Uint8Array.from(Buffer.from(assignment.report.package_spec.exports_root.slice(2), "hex")),
                exports_count: assignment.report.package_spec.exports_count,
              },
              context: {
                anchor: Uint8Array.from(Buffer.from(assignment.report.context.anchor.slice(2), "hex")),
                state_root: Uint8Array.from(Buffer.from(assignment.report.context.state_root.slice(2), "hex")),
                beefy_root: Uint8Array.from(Buffer.from(assignment.report.context.beefy_root.slice(2), "hex")),
                lookup_anchor: Uint8Array.from(Buffer.from(assignment.report.context.lookup_anchor.slice(2), "hex")),
                lookup_anchor_slot: assignment.report.context.lookup_anchor_slot,
                prerequisites: assignment.report.context.prerequisites.map((p: any) =>
                  Uint8Array.from(Buffer.from(p.slice(2), "hex"))
                ),
              },
              core_index: assignment.report.core_index,
              authorizer_hash: Uint8Array.from(Buffer.from(assignment.report.authorizer_hash.slice(2), "hex")),
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
            },
            timeout: assignment.timeout,
          };
        }),
        curr_validators: raw.pre_state.curr_validators.map((validator: any) => ({
          bandersnatch: Uint8Array.from(Buffer.from(validator.bandersnatch.slice(2), "hex")),
          ed25519: Uint8Array.from(Buffer.from(validator.ed25519.slice(2), "hex")),
          bls: Uint8Array.from(Buffer.from(validator.bls.slice(2), "hex")),
          metadata: Uint8Array.from(Buffer.from(validator.metadata.slice(2), "hex")),
        })),
      },
      output: raw.output.err
      ? { err: ErrorCode[
          raw.output.err.toUpperCase().replace(/-/g, "_") as keyof typeof ErrorCode
        ] }
      : raw.output.ok
        ? { ok: {
          reported: raw.output.ok.reported.map((r: any) => ({
            package_spec: {
              hash: Uint8Array.from(Buffer.from(r.package_spec.hash.slice(2), "hex")),
              length: r.package_spec.length,
              erasure_root: Uint8Array.from(Buffer.from(r.package_spec.erasure_root.slice(2), "hex")),
              exports_root: Uint8Array.from(Buffer.from(r.package_spec.exports_root.slice(2), "hex")),
              exports_count: r.package_spec.exports_count,
            },
            context: {
              anchor: Uint8Array.from(Buffer.from(r.context.anchor.slice(2), "hex")),
              state_root: Uint8Array.from(Buffer.from(r.context.state_root.slice(2), "hex")),
              beefy_root: Uint8Array.from(Buffer.from(r.context.beefy_root.slice(2), "hex")),
              lookup_anchor: Uint8Array.from(Buffer.from(r.context.lookup_anchor.slice(2), "hex")),
              lookup_anchor_slot: r.context.lookup_anchor_slot,
              prerequisites: r.context.prerequisites.map((p: any) =>
                Uint8Array.from(Buffer.from(p.slice(2), "hex"))
              ),
            },
            core_index: r.core_index,
            authorizer_hash: Uint8Array.from(Buffer.from(r.authorizer_hash.slice(2), "hex")),
            auth_output: Uint8Array.from(Buffer.from(r.auth_output.slice(2), "hex")),
            segment_root_lookup: r.segment_root_lookup.map((s: any) =>
              Uint8Array.from(Buffer.from(s.slice(2), "hex"))
            ),
            results: r.results.map((res: any) => ({
              service_id: res.service_id,
              code_hash: Uint8Array.from(Buffer.from(res.code_hash.slice(2), "hex")),
              payload_hash: Uint8Array.from(Buffer.from(res.payload_hash.slice(2), "hex")),
              accumulate_gas: res.accumulate_gas,
              result: res.result.ok
                ? { ok: Uint8Array.from(Buffer.from(res.result.ok.slice(2), "hex")) }
                : { panic: null },
            })),
          }))
          } }
        : (() => { throw new Error("Assurances Test: Output must have either 'err' or 'ok'"); })(),

      post_state: {
        avail_assignments: raw.post_state.avail_assignments.map((assignment: any) => {
          if (!assignment) {
            return null;
          }
          return {
            report: {
              package_spec: {
                hash: Uint8Array.from(Buffer.from(assignment.report.package_spec.hash.slice(2), "hex")),
                length: assignment.report.package_spec.length,
                erasure_root: Uint8Array.from(Buffer.from(assignment.report.package_spec.erasure_root.slice(2), "hex")),
                exports_root: Uint8Array.from(Buffer.from(assignment.report.package_spec.exports_root.slice(2), "hex")),
                exports_count: assignment.report.package_spec.exports_count,
              },
              context: {
                anchor: Uint8Array.from(Buffer.from(assignment.report.context.anchor.slice(2), "hex")),
                state_root: Uint8Array.from(Buffer.from(assignment.report.context.state_root.slice(2), "hex")),
                beefy_root: Uint8Array.from(Buffer.from(assignment.report.context.beefy_root.slice(2), "hex")),
                lookup_anchor: Uint8Array.from(Buffer.from(assignment.report.context.lookup_anchor.slice(2), "hex")),
                lookup_anchor_slot: assignment.report.context.lookup_anchor_slot,
                prerequisites: assignment.report.context.prerequisites.map((p: any) =>
                  Uint8Array.from(Buffer.from(p.slice(2), "hex"))
                ),
              },
              core_index: assignment.report.core_index,
              authorizer_hash: Uint8Array.from(Buffer.from(assignment.report.authorizer_hash.slice(2), "hex")),
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
            },
            timeout: assignment.timeout,
          };
        }),
        curr_validators: raw.post_state.curr_validators.map((validator: any) => ({
          bandersnatch: Uint8Array.from(Buffer.from(validator.bandersnatch.slice(2), "hex")),
          ed25519: Uint8Array.from(Buffer.from(validator.ed25519.slice(2), "hex")),
          bls: Uint8Array.from(Buffer.from(validator.bls.slice(2), "hex")),
          metadata: Uint8Array.from(Buffer.from(validator.metadata.slice(2), "hex")),
        })),
      },
    };

    // Encode the `Assurances` structure
    const encoded = AssurancesCodec.enc(assurances);
    console.log("Encoded Assurances (hex):", toHex(encoded));

    // Decode back
    const decoded = AssurancesCodec.dec(encoded);

    // Prepare for comparison
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(assurances);

    // Write outputs for inspection (ensure the output directories exist)
    const outputDir = path.resolve(__dirname, "../../output/stf/assurances");
    writeFileSync(path.join(outputDir, "encodedAssurances.txt"), readableEncoded);
    writeFileSync(
      path.join(outputDir, "decodedAssurances.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.join(outputDir, "originalAssurances.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // Assert equality
    expect(decoded).toStrictEqual(assurances);
  });



  it("decodes assurance_for_not_engaged_core-1.bin and verifies round-trip encoding", () => {
    // Define the path to the binary test file
    const binPath = path.resolve(__dirname, "../../../stf/assurances/data/assurance_for_not_engaged_core-1.bin");
    
    // Read the binary file as Uint8Array
    const binary = new Uint8Array(readFileSync(binPath));
    console.log("Conformance binary (hex):", toHex(binary));


    console.log("Conformance binary (hex):", toHex(binary));
    // Decode the binary data into Assurances structure
    const decoded = AssurancesCodec.dec(binary);
    console.log("Decoded Conformance Assurances:", JSON.stringify(convertToReadableFormat(decoded), null, 2));

    // Optionally, write the decoded data to a JSON file for inspection
    const decodedJsonPath = path.resolve(__dirname, "../../output/stf/assurances/decodedConformanceAssurances.json");
    writeFileSync(decodedJsonPath, JSON.stringify(convertToReadableFormat(decoded), null, 2));

    // Re-encode the decoded data back into binary
    const reEncoded = AssurancesCodec.enc(decoded);
    console.log("Re-encoded binary (hex):", toHex(reEncoded));

    // Optionally, write the re-encoded binary to a file for inspection
    const reEncodedBinPath = path.resolve(__dirname, "../../output/stf/assurances/reEncodedConformanceAssurances.bin");
    writeFileSync(reEncodedBinPath, Buffer.from(reEncoded));

    // Verify that the re-encoded binary matches the original binary data
    expect(reEncoded).toEqual(binary);
  });
});
