import path from "path";
import { Disputes } from "../../../stf/disputes/types";
import { DisputesCodec } from "../../../stf/disputes/codecs/DisputesCodec";
import { createCodecTestSuite } from "../../utils/createCodecTestSuite";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

const testFiles = [
  "progress_invalidates_avail_assignments-1",
  "progress_with_bad_signatures-1",
  "progress_with_bad_signatures-2",
  "progress_with_culprits-1",
  "progress_with_culprits-2",
  "progress_with_culprits-3",
  "progress_with_culprits-4",
  "progress_with_culprits-5",
  "progress_with_culprits-6",
  "progress_with_culprits-7",
  "progress_with_faults-1",
  "progress_with_faults-2",
  "progress_with_faults-3",
  "progress_with_faults-4",
  "progress_with_faults-5",
  "progress_with_faults-6",
  "progress_with_faults-7",
  "progress_with_no_verdicts-1",
  "progress_with_verdict_signatures_from_previous_set-1",
  "progress_with_verdict_signatures_from_previous_set-2",
  "progress_with_verdicts-1",
  "progress_with_verdicts-2",
  "progress_with_verdicts-3",
  "progress_with_verdicts-4",
  "progress_with_verdicts-5",
  "progress_with_verdicts-6",
];



const testVectorsDir = path.join(JAM_TEST_VECTORS, "stf/disputes", CHAIN_TYPE);
const outDir = path.resolve(__dirname, "../../output/stf/disputes");

createCodecTestSuite<Disputes>(
  DisputesCodec,
  "Disputes",
  testVectorsDir,
  outDir,
  testFiles,
);
