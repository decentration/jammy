import fs, { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Reports } from "../../../stf/reports/types";    
import { ReportsCodec } from "../../../stf/reports/codecs/ReportsCodec"; 
import { toHex, convertToReadableFormat } from "../../../utils";
import { convertHexFieldsToBytes, toUint8Array, deepConvertHexToBytes } from "../../../codecs";


describe("ReportsCodec", () => {


  const testFiles = [
       "anchor_not_recent-1.json",
        "bad_beefy_mmr-1.json",
        "bad_code_hash-1.json",
        "bad_core_index-1.json",
        "bad_service_id-1.json",
        "bad_signature-1.json",
        "bad_state_root-1.json",
        "bad_validator_index-1.json",
        "big_work_report_output-1.json",
        "core_engaged-1.json",
        "dependency_missing-1.json",
        "duplicate_package_in_recent_history-1.json",
        "duplicated_package_in_report-1.json",
        "future_report_slot-1.json",
        "high_work_report_gas-1.json",
        "many_dependencies-1.json",
        "multiple_reports-1.json",
        "no_enough_guarantees-1.json",
        "not_authorized-1.json",
        "not_authorized-2.json",
        "not_sorted_guarantor-1.json",
        "out_of_order_guarantees-1.json",
        "report_before_last_rotation-1.json",
        "report_curr_rotation-1.json",
        "report_prev_rotation-1.json",
        "reports_with_dependencies-1.json",
        "reports_with_dependencies-2.json",
        "reports_with_dependencies-3.json",
        "reports_with_dependencies-4.json",
        "reports_with_dependencies-5.json",
        "reports_with_dependencies-6.json",
        "segment_root_lookup_invalid-1.json",
        "segment_root_lookup_invalid-2.json",
        "service_item_gas_too_low-1.json",
        "too_big_work_report_output-1.json",
        "too_high_work_report_gas-1.json",
        "too_many_dependencies-1.json",
        "wrong_assignment-1.json"

  ]

  testFiles.forEach((fileName) => {

  it(`encodes/decodes an entire Reports object from ${fileName}`, () => {
    // 1) Load test vector JSON
    const filePath = path.join(__dirname, "../../../stf/reports/data/tiny",
      fileName
      );

      console.log("checking filePath", filePath);

      // 2) Parse the top-level shape { input, pre_state, output, post_state }
      // const testVector = JSON.parse(rawJson);
    const jsonPath = path.resolve(__dirname, "../../../stf/reports/data/tiny/bad_code_hash-1.json");
    const rawJson = JSON.parse(readFileSync(filePath, "utf-8"));

    // 2) Convert all "0x..." => Uint8Array
    
    const reportsObj = deepConvertHexToBytes(rawJson) as Reports;

    console.log("reportsObj:", rawJson, reportsObj);

    // 3) Encode
    const encoded = ReportsCodec.enc(reportsObj);
    

    // 4) Decode
    const decoded = ReportsCodec.dec(encoded);

    // 5) Convert for debug
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(reportsObj);

    const outDir = path.resolve(__dirname, "../../output/stf/reports");
    writeFileSync(path.join(outDir, "encodedReports.hex"), readableEncoded);
    writeFileSync(
      path.join(outDir, "decodedReports.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.join(outDir, "originalReports.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    console.log("readableDecoded:", readableDecoded.input.guarantees);
    // 6) Validate roundtrip
    expect(readableDecoded).toStrictEqual(readableOriginal);
  });
});

// describe("ReportsCodec conformance binary", () => {
//     it("decodes a .bin conformance file => re-encodes => must match exactly", () => {
//       // 1) read bin file
//       const binPath = path.resolve(
//         __dirname,
//         "../../../stf/reports/data/tiny/bad_code_hash-1.bin"
//       );
//       const rawBin = new Uint8Array(readFileSync(binPath));
//       console.log("Reports bin (hex):", toHex(rawBin));
  
//       // 2) decode
//       const decoded: Reports = ReportsCodec.dec(rawBin);
  
//       // 3) debug info => JSON
//       const outDir = path.resolve(__dirname, "../../output/stf/reports");
//       writeFileSync(
//         path.join(outDir, "decodedReportsConformance.json"),
//         JSON.stringify(convertToReadableFormat(decoded), null, 2)
//       );
  
//       // 4) re-encode
//       const reEncoded = ReportsCodec.enc(decoded);
//       console.log("Re-encoded (hex):", toHex(reEncoded));
  
//       // 5) write re encoded bin
//       writeFileSync(
//         path.join(outDir, "reEncodedReportsConformance.bin"),
//         Buffer.from(reEncoded)
//       );
  
//       // 6) comp
//       expect(reEncoded).toEqual(rawBin);
//     });
//   });
});