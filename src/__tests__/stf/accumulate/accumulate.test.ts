import path from "path";
import { AccumulateStf } from "../../../stf/accumulate/types"; 
import { AccumulateStfCodec } from "../../../stf/accumulate/codecs/AccumulateStfCodec"
import { createCodecTestSuite, TestMode } from "../../utils/createCodecTestSuite";
import { parseAccumulateStfJson } from "../../../stf/accumulate/utils/parsers/parseAccumulateStfJson";

import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";


const testFiles = [
    "accumulate_ready_queued_reports-1",
    "enqueue_and_unlock_chain_wraps-2",
    "enqueue_and_unlock_with_sr_lookup-2",
    "process_one_immediate_report-1",
    "enqueue_and_unlock_chain_wraps-3",
    "queues_are_shifted-1",
    "enqueue_and_unlock_chain-1",
    "enqueue_and_unlock_chain_wraps-4",
    "enqueue_self_referential-1",
    "queues_are_shifted-2",
    "enqueue_and_unlock_chain-2",
    "enqueue_and_unlock_chain_wraps-5",
    "enqueue_self_referential-2",
    "ready_queue_editing-1",
    "enqueue_and_unlock_chain-3",
    "enqueue_self_referential-3",
    "enqueue_and_unlock_simple-1",
    "ready_queue_editing-2",
    "enqueue_and_unlock_chain-4",
    "enqueue_self_referential-4",
    "enqueue_and_unlock_simple-2",
    "ready_queue_editing-3",
    "enqueue_and_unlock_chain_wraps-1",
    "no_available_reports-1",
    "enqueue_and_unlock_with_sr_lookup-1"
];

  const testVectorsDir = path.join(JAM_TEST_VECTORS, "accumulate", CHAIN_TYPE);
  const outDir = path.resolve(__dirname, "../../output/stf/accumulate");

  createCodecTestSuite<AccumulateStf>(
    AccumulateStfCodec,      // Codec STF name
    "Accumulate",            // Friendly name
    testVectorsDir,          // Path to test vectors, name of file only, without the file type 
    outDir,                  // Output directory for debug
    testFiles,               // The array of test file names
    parseAccumulateStfJson,  // The function to parse JSON
  );




  