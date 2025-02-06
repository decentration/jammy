import fs from "fs";
import path from "path";
import { applyReportsStf } from "../../../stf/reports/applyReportsStf";
import { convertToReadableFormat } from "../../../utils";
import { deepConvertHexToBytes } from "../../../codecs";

describe("Reports STF - conformance tests", () => {

    const testFiles = [
        "anchor_not_recent-1.json",
        // "bad_beefy_mmr-1.json",
        "bad_code_hash-1.json",
        "bad_core_index-1.json",
        "bad_service_id-1.json",
        "bad_signature-1.json",
        "bad_state_root-1.json",
        "bad_validator_index-1.json",
        "big_work_report_output-1.json",
        // "core_engaged-1.json",
        "dependency_missing-1.json",
        "duplicate_package_in_recent_history-1.json",
        "duplicated_package_in_report-1.json",
        "future_report_slot-1.json",
        // "high_work_report_gas-1.json",
        // "many_dependencies-1.json",
        // "multiple_reports-1.json",
        // "no_enough_guarantees-1.json",
        "not_authorized-1.json",
        "not_authorized-2.json",
        "not_sorted_guarantor-1.json",
        // "out_of_order_guarantees-1.json",
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
        // "wrong_assignment-1.json"
    ]

    testFiles.forEach((fileName) => {
        it(`should pass ${fileName}`, async () => {
            // 1) Read JSON test vector from file
            const filePath = path.join(__dirname, "../../../stf/reports/data/tiny",
            fileName
            );
            console.log("checking filePath", filePath);
            const rawJson = fs.readFileSync(filePath, "utf8");

            // 2) Parse the top-level shape { input, pre_state, output, post_state }
            const testVector = JSON.parse(rawJson);

            // console.log("testVector", testVector);
            // 3) Convert any "0x..." strings -> Uint8Array for input/pre_state/post_state
            const input = deepConvertHexToBytes(testVector.input);
            const pre_state = deepConvertHexToBytes(testVector.pre_state);
            const expectedOutput = testVector.output;
            const expectedPostState = testVector.post_state;

            // 4) Call the STF
            const { output, postState } = await applyReportsStf(pre_state, input);

            // if output contains Uint8Arrays, convert them to hex strings
            const convertedOutput = convertToReadableFormat(output);

            console.log("convertedOutput", convertedOutput);
            console.log("expectedOutput", expectedOutput);
            // 5) Compare results
            expect(convertedOutput).toEqual(expectedOutput);
            expect(convertToReadableFormat(postState)).toEqual(expectedPostState);
            });
        });
    });
