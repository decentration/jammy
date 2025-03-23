import fs from "fs";
import path from "path";
import { applyAssurancesStf } from "../../../stf/assurances/applyAssurancesStf";
import { convertToReadableFormat } from "../../../utils";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

describe("Assurances STF conformance", () => {
  const testFiles = [
    "assurance_for_not_engaged_core-1.json",
    "assurances_with_bad_signature-1.json",
    "assurances_with_bad_validator_index-1.json",
    "assurance_with_bad_attestation_parent-1.json",
    "assurances_for_stale_report-1.json",
    "assurers_not_sorted_or_unique-1.json",
    "assurers_not_sorted_or_unique-2.json",
    "no_assurances-1.json",
    "no_assurances_with_stale_report-1.json",
    "some_assurances-1.json",
  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, async () => {
      // 1) Read JSON test vector from file
      const filePath = path.join(`${JAM_TEST_VECTORS}/assurances`, `${CHAIN_TYPE}`,  fileName);
      const rawJson = fs.readFileSync(filePath, "utf8");

      // 2) Parse the top-level shape { input, pre_state, output, post_state }
      const testVector = JSON.parse(rawJson);
      // console.log("testVector", testVector);
      // 3) Convert any "0x..." strings -> Uint8Array for input/pre_state/post_state
      const input = testVector.input;
      const pre_state = testVector.pre_state;
      const expectedOutput = testVector.output;
      const expectedPostState = testVector.post_state;

      // 4) Call the STF
      const { output, postState } = await applyAssurancesStf(pre_state, input);

      // 5) Compare results
      expect(output).toEqual(expectedOutput);
      expect(convertToReadableFormat(postState)).toEqual(expectedPostState);
    });
  });
});
