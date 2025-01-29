import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Report } from "../../types/types";  
import { ReportCodec } from "../../codecs";  
import { toHex, convertToReadableFormat } from "../../utils";  

function parseReportJSON(raw: any): Report {
  return {
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
      prerequisites: raw.context.prerequisites.map((p: string) =>
        Uint8Array.from(Buffer.from(p.slice(2), "hex"))
      ),
    },
    core_index: raw.core_index, // u16 as a number
    authorizer_hash: Uint8Array.from(Buffer.from(raw.authorizer_hash.slice(2), "hex")),
    auth_output: Uint8Array.from(Buffer.from(raw.auth_output.slice(2), "hex")),
    segment_root_lookup: raw.segment_root_lookup.map((item: any) => ({
      work_package_hash: Uint8Array.from(Buffer.from(item.work_package_hash.slice(2), "hex")),
      segment_tree_root: Uint8Array.from(Buffer.from(item.segment_tree_root.slice(2), "hex")),
    })),
    results: raw.results.map((r: any) => ({
      service_id: r.service_id,
      code_hash: Uint8Array.from(Buffer.from(r.code_hash.slice(2), "hex")),
      payload_hash: Uint8Array.from(Buffer.from(r.payload_hash.slice(2), "hex")),
      accumulate_gas: r.accumulate_gas,
      result: (() => {
        if (r.result.ok != null) {
          return { ok: Uint8Array.from(Buffer.from(r.result.ok.slice(2), "hex")) };
        } else if (r.result.panic != null) {
          return { panic: null };
        } else {
          return { placeholder: null };
        }
      })(),
    })),
  };
}

describe("ReportCodec test", () => {

  console.log("ReportCodec test");
  
  it("encodes/decodes report-1 from JSON and compares with its known hex dump", () => {
    // 1) Read JSON
    const jsonPath = path.resolve(__dirname, "../../data/reports/report-1.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    const report: Report = parseReportJSON(raw);

    // 2) Encode
    const encoded = ReportCodec.enc(report);

    // 3) Compare with known hex dump
    const hexPath = path.resolve(__dirname, "../../data/reports/report-1-hex.txt");
    // change knownTxtObt to read txt not json
    const knownHexStr = readFileSync(hexPath, "utf-8");
    // get actualHex and remove 0x
    const actualHex = toHex(encoded).slice(2);
    expect(actualHex).toBe(knownHexStr);  // or .toLowerCase() if needed

    // 4) Decode & round-trip check
    const decoded = ReportCodec.dec(encoded);
    expect(decoded).toEqual(report);

    // 5) Debug outputs
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(report);

    const outDir = path.resolve(__dirname, "../../__tests__/output/reports/");
    writeFileSync(path.join(outDir, "encodedReport.txt"), readableEncoded);
    writeFileSync(
      path.join(outDir, "decodedReport.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.join(outDir, "originalReport.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // 6) check empty prerequisites confirm [] is 00
    if (report.context.prerequisites.length === 0) {
     
      expect(decoded.context.prerequisites).toHaveLength(0);
    }
  });

//   // Test #2
//   it("encodes/decodes report-2 from JSON and compares with its known hex dump", () => {
//     const jsonPath = path.resolve(__dirname, "../../data/reports/report-2.json");
//     const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
//     const report: Report = parseReportJSON(raw);

//     const encoded = ReportCodec.enc(report);

//     // Compare with known hex
//     const hexPath = path.resolve(__dirname, "../../data/reports/report-2-hex.txt");
//     const knownHexStr = readFileSync(hexPath, "utf-8");    

//     const actualHex = toHex(encoded);
//     expect(actualHex).toBe(knownHexStr);

//     const decoded = ReportCodec.dec(encoded);
//     expect(decoded).toEqual(report);

//   });

});
