import fs, { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Reports } from "../../../stf/reports/types";    
import { ReportsCodec } from "../../../stf/reports/codecs/ReportsCodec"; 
import { toHex, convertToReadableFormat } from "../../../utils";
import { convertHexFieldsToBytes, toUint8Array, deepConvertHexToBytes } from "../../../codecs";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";


const testFiles = [
  "anchor_not_recent-1",
   "bad_beefy_mmr-1",
   "bad_code_hash-1",
   "bad_core_index-1",
   "bad_service_id-1",
   "bad_signature-1",
   "bad_state_root-1",
   "bad_validator_index-1",
   "big_work_report_output-1",
   "core_engaged-1",
   "dependency_missing-1",
   "duplicate_package_in_recent_history-1",
   "duplicated_package_in_report-1",
   "future_report_slot-1",
   "high_work_report_gas-1",
   "many_dependencies-1",
   "multiple_reports-1",
   "no_enough_guarantees-1",
   "not_authorized-1",
   "not_authorized-2",
   "not_sorted_guarantor-1",
   "out_of_order_guarantees-1",
   "report_before_last_rotation-1",
   "report_curr_rotation-1",
   "report_prev_rotation-1",
   "reports_with_dependencies-1",
   "reports_with_dependencies-2",
   "reports_with_dependencies-3",
   "reports_with_dependencies-4",
   "reports_with_dependencies-5",
   "reports_with_dependencies-6",
   "segment_root_lookup_invalid-1",
   "segment_root_lookup_invalid-2",
   "service_item_gas_too_low-1",
   "too_big_work_report_output-1",
   "too_high_work_report_gas-1",
   "too_many_dependencies-1",
   "wrong_assignment-1"
]

testFiles.forEach((fileName) => {
  describe("ReportsCodec", () => {



    it(`encodes/decodes an entire Reports object from ${fileName}`, () => {
      // 1) Load test vector JSON
      const filePath = path.join(path.join(`${JAM_TEST_VECTORS}/reports`, `${CHAIN_TYPE}`,
        fileName.concat(".json")
        ));

        console.log("checking filePath", filePath);

        // 2) Parse the top-level shape { input, pre_state, output, post_state }
        // const testVector = JSON.parse(rawJson);
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

  describe("ReportsCodec conformance binary", () => {
    it("decodes a .bin conformance file => re-encodes => must match exactly", () => {
      // 1) read bin file

      const binPath = path.join(path.join(`${JAM_TEST_VECTORS}/reports`, `${CHAIN_TYPE}`, fileName.concat(".bin"))
      );
      const rawBin = new Uint8Array(readFileSync(binPath));
      console.log("Reports bin (hex):", toHex(rawBin));
  
      // 2) decode
      const decoded: Reports = ReportsCodec.dec(rawBin);
  
      // 3) debug info => JSON
      const outDir = path.resolve(__dirname, "../../output/stf/reports");
      writeFileSync(
        path.join(outDir, "decodedReportsConformance.json"),
        JSON.stringify(convertToReadableFormat(decoded), null, 2)
      );
  
      // 4) re-encode
      const reEncoded = ReportsCodec.enc(decoded);
      console.log("Re-encoded (hex):", toHex(reEncoded));
  
      // 5) write re encoded bin
      writeFileSync(
        path.join(outDir, "reEncodedReportsConformance.bin"),
       (Buffer.from(reEncoded).toString("hex"))
      );
  
      // 6) comp
      expect(reEncoded).toEqual(rawBin);
    });
  });
});