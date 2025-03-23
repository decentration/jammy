import fs from "fs";
import path from "path";
import { applyDisputesStf } from "../../../stf/disputes/applyDisputesStf";
import { convertToReadableFormat } from "../../../utils";
import { deepConvertHexToBytes } from "../../../codecs";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

describe("Disputes STF conformance", () => {
  const testFiles = [
    "progress_invalidates_avail_assignments-1",
    "progress_with_bad_signatures-1",
    "progress_with_bad_signatures-2", // TODO there was an error in this conformance test by davxy, maybe he has updated it in a later version. 
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

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      const filePath = path.join(`${JAM_TEST_VECTORS}/disputes`, `${CHAIN_TYPE}`,  fileName.concat('.json'));
      
      const rawJson = fs.readFileSync(filePath, "utf8");

      const { input, pre_state, output, post_state } = JSON.parse(rawJson);
      const inputBytes = deepConvertHexToBytes(input);
      const pre_stateBytes = deepConvertHexToBytes(pre_state);

      const { output: stfOutput, postState } = applyDisputesStf(pre_stateBytes, inputBytes);

      expect(convertToReadableFormat(stfOutput)).toEqual(output);
      expect(convertToReadableFormat(postState)).toEqual(post_state);

    });
  });
});
