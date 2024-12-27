// src/__tests__/reports/report.test.ts

import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Report } from "../../block/types";  
import { ReportCodec } from "../../block/codecs";  

function toHex(uint8: Uint8Array): string {
  return "0x" + Buffer.from(uint8).toString("hex");
}

// Recursively convert all Uint8Arrays -> hex for readable output
function convertToReadableFormat(obj: any): any {
  if (obj instanceof Uint8Array) {
    return toHex(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(convertToReadableFormat);
  } else if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = convertToReadableFormat(v);
    }
    return result;
  }
  return obj;
}

describe("ReportCodec test", () => {
  it("encodes/decodes an entire report from JSON", () => {
    // Load the JSON (ensure the path is correct)
    const jsonPath = path.resolve(__dirname, "../../data/guarantees/report.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
  
    // Construct the Report object
    const report: Report = {
      package_spec: {
        hash: Uint8Array.from(Buffer.from(raw.package_spec.hash.slice(2), "hex")),
        length: raw.package_spec.length,
        erasure_root: Uint8Array.from(Buffer.from(raw.package_spec.erasure_root.slice(2), "hex")),
        exports_root: Uint8Array.from(Buffer.from(raw.package_spec.exports_root.slice(2), "hex")),
        exports_count: raw.package_spec.exports_count,
      },
      context: {
        anchor: Uint8Array.from(Buffer.from(raw.context.anchor.slice(2), "hex")),
        state_root: Uint8Array.from(Buffer.from(raw.context.state_root.slice(2), "hex")),
        beefy_root: Uint8Array.from(Buffer.from(raw.context.beefy_root.slice(2), "hex")),
        lookup_anchor: Uint8Array.from(Buffer.from(raw.context.lookup_anchor.slice(2), "hex")),
        lookup_anchor_slot: raw.context.lookup_anchor_slot,
        prerequisites: raw.context.prerequisites.map((p: any) => 
          Uint8Array.from(Buffer.from(p.slice(2), "hex"))
        ),
      },
      core_index: raw.core_index, // u16 as number
      authorizer_hash: Uint8Array.from(Buffer.from(raw.authorizer_hash.slice(2), "hex")),
      auth_output: Uint8Array.from(Buffer.from(raw.auth_output.slice(2), "hex")),
      segment_root_lookup: raw.segment_root_lookup.map((s: any) => 
        Uint8Array.from(Buffer.from(s.slice(2), "hex"))
      ),
      results: raw.results.map((r: any) => ({
        service_id: r.service_id, // number (u32)
        code_hash: Uint8Array.from(Buffer.from(r.code_hash.slice(2), "hex")),
        payload_hash: Uint8Array.from(Buffer.from(r.payload_hash.slice(2), "hex")),
        accumulate_gas: r.accumulate_gas, // number (u32)
        result: (() => {
          if (r.result.ok != null) {
            return { ok: Uint8Array.from(Buffer.from(r.result.ok.slice(2), "hex")) };
          } else if (r.result.panic != null) {
            return { panic: null };
          } else {
            return { placeholder: null }; // Placeholder for future variants
          }
        })(),
      })),
    }

    // 1) Encode the Report
    let encoded: Uint8Array;
    try {
      encoded = ReportCodec.enc(report);
    } catch (error) {
      console.error("Encoding Error:", error);
      throw error;
    }

    // 2) Decode the Report
    let decoded: Report;
    try {
      decoded = ReportCodec.dec(encoded);
    } catch (error) {
      console.error("Decoding Error:", error);
      throw error;
    }

    console.log("Report:", report);
    
    // 3) Convert to human-readable format for debugging
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(report);

    // console.log("readableEncoded:", readableEncoded);
    // console.log("Decoded:", JSON.stringify(readableDecoded, null, 2));
    // console.log("Original:", JSON.stringify(readableOriginal, null, 2));

    // Optionally write results to files for debugging
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/report/encodedReport.txt"),
      readableEncoded
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/report/decodedReport.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/report/originalReport.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // 4) Validate round-trip encoding/decoding
    // Compare each field individually to handle Uint8Array comparisons
    expect(decoded.package_spec.hash).toEqual(report.package_spec.hash);
    expect(decoded.package_spec.length).toBe(report.package_spec.length);
    expect(decoded.package_spec.erasure_root).toEqual(report.package_spec.erasure_root);
    expect(decoded.package_spec.exports_root).toEqual(report.package_spec.exports_root);
    expect(decoded.package_spec.exports_count).toBe(report.package_spec.exports_count);

    expect(decoded.context.anchor).toEqual(report.context.anchor);
    expect(decoded.context.state_root).toEqual(report.context.state_root);
    expect(decoded.context.beefy_root).toEqual(report.context.beefy_root);
    expect(decoded.context.lookup_anchor).toEqual(report.context.lookup_anchor);
    expect(decoded.context.lookup_anchor_slot).toBe(report.context.lookup_anchor_slot);
    expect(decoded.context.prerequisites).toEqual(report.context.prerequisites);

    expect(decoded.core_index).toBe(report.core_index);
    expect(decoded.authorizer_hash).toEqual(report.authorizer_hash);
    expect(decoded.auth_output).toEqual(report.auth_output);
    expect(decoded.segment_root_lookup).toEqual(report.segment_root_lookup);

    // Compare results array
    expect(decoded.results.length).toBe(report.results.length);
    for (let i = 0; i < report.results.length; i++) {
      const originalResult = report.results[i];
      const decodedResult = decoded.results[i];

      expect(decodedResult.service_id).toBe(originalResult.service_id);
      expect(decodedResult.code_hash).toEqual(originalResult.code_hash);
      expect(decodedResult.payload_hash).toEqual(originalResult.payload_hash);
      expect(decodedResult.accumulate_gas).toBe(originalResult.accumulate_gas);
      expect(decodedResult.result).toEqual(originalResult.result);
    }
  });
});
