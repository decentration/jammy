import fs, { mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { Reports } from "../../../stf/reports/types";    
import { ReportsCodec } from "../../../stf/reports/codecs/ReportsCodec"; 
import { toHex, convertToReadableFormat } from "../../../utils";
import { convertHexFieldsToBytes, toUint8Array, deepConvertHexToBytes } from "../../../codecs";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";
import { createCodecTestSuite } from "../../utils/createCodecTestSuite";


const testFiles = [
  "anchor_not_recent-1",
   "bad_beefy_mmr-1",
   "bad_code_hash-1",
   "bad_core_index-1",
   "bad_service_id-1",
   "bad_signature-1",
   "bad_state_root-1",
   "bad_validator_index-1",
   "big_work_report_output-1", // done
   "core_engaged-1",
   "dependency_missing-1",
   "duplicate_package_in_recent_history-1",
   "duplicated_package_in_report-1",
   "future_report_slot-1",
   "high_work_report_gas-1", // done
   "many_dependencies-1", // done
   "multiple_reports-1", // done 
   "no_enough_guarantees-1",
   "not_authorized-1",
   "not_authorized-2",
   "not_sorted_guarantor-1",
   "out_of_order_guarantees-1",
   "report_before_last_rotation-1",
   "report_curr_rotation-1", // done 
   "report_prev_rotation-1", // done 
   "reports_with_dependencies-1", // done 
   "reports_with_dependencies-2", // done 
   "reports_with_dependencies-3",// done 
   "reports_with_dependencies-4",// done 
   "reports_with_dependencies-5",// done 
   "reports_with_dependencies-6",// done 
   "segment_root_lookup_invalid-1",
   "segment_root_lookup_invalid-2",
   "service_item_gas_too_low-1",
   "too_big_work_report_output-1",
   "too_high_work_report_gas-1",
   "too_many_dependencies-1",
   "with_avail_assignments-1", // done 
   "wrong_assignment-1"
]

const testVectorsDir = path.join(JAM_TEST_VECTORS, "stf/reports", CHAIN_TYPE);
  const outDir = path.resolve(__dirname, "../../output/stf/reports");

  createCodecTestSuite<Reports>(
    ReportsCodec,      // Codec STF name
    "Reports",            // Friendly name
    testVectorsDir,          // Path to test vectors, name of file only, without the file type 
    outDir,                  // Output directory for debug
    testFiles,               // The array of test file names
    // parseAccumulateStfJson,  // The function to parse JSON
  );
