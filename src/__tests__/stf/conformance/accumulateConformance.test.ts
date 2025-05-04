import fs from "fs";
import path from "path";
import { applyAccumulateStf } from "../../../stf/accumulate/applyAccumulateStf";
import { convertToReadableFormat } from "../../../utils";
import { deepConvertHexToBytes } from "../../../codecs";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

describe("Accumulate STF - conformance tests", () => {

    const testFiles = [
        "accumulate_ready_queued_reports-1",  //
        "enqueue_and_unlock_chain-1",
        "enqueue_and_unlock_chain-2",
        "enqueue_and_unlock_chain-3",
        "enqueue_and_unlock_chain-4",
        "enqueue_and_unlock_chain_wraps-1",
        "enqueue_and_unlock_chain_wraps-2",
        "enqueue_and_unlock_chain_wraps-3",  //
        "enqueue_and_unlock_chain_wraps-4",  //
        "enqueue_and_unlock_chain_wraps-5",
        "enqueue_and_unlock_simple-1",
        "enqueue_and_unlock_simple-2",
        "enqueue_and_unlock_with_sr_lookup-1",      
        "enqueue_and_unlock_with_sr_lookup-2",
        "enqueue_self_referential-1",
        "enqueue_self_referential-2",
        "enqueue_self_referential-3",
        "enqueue_self_referential-4",
        "no_available_reports-1",
        "process_one_immediate_report-1",
        "queues_are_shifted-1",            //        
        "queues_are_shifted-2",           //  
        "ready_queue_editing-1",
        "ready_queue_editing-2",
        "ready_queue_editing-3",
    ];

    testFiles.forEach((fileName) => {
        it(`should pass ${fileName}`, async () => {
            // 1) Read JSON test vector from file
            const filePath = path.join(`${JAM_TEST_VECTORS}/accumulate`, `${CHAIN_TYPE}`, fileName.concat(".json"));
            console.log("checking filePath", filePath);
            const rawJson = fs.readFileSync(filePath, "utf8");

            // 2) Parse the top-level shape { input, pre_state, output, post_state }
            const testVector = JSON.parse(rawJson);
            // console.log("testVector", testVector);

            // console.log("testVector", testVector);
            // 3) Convert any "0x..." strings -> Uint8Array for input/pre_state/post_state
            const input = deepConvertHexToBytes(testVector.input);
            const pre_state = deepConvertHexToBytes(testVector.pre_state);
            const expectedOutput = testVector.output;
            const expectedPostState = testVector.post_state;

            // 4) Call the STF
            const { output, postState } = await applyAccumulateStf(pre_state, input);

            // if output contains Uint8Arrays, convert them to hex strings
            const convertedOutput = convertToReadableFormat(output);

            // console.log("convertedOutput", convertedOutput);
            // console.log("expectedOutput", expectedOutput);

            console.log("postState", convertToReadableFormat(postState));
            // 5) Compare results
            expect(convertedOutput).toEqual(expectedOutput);
            expect(convertToReadableFormat(postState)).toEqual(expectedPostState);
            });
        });
    });
