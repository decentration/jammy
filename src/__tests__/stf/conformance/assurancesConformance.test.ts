import fs from "fs";
import path from "path";
import { applyAssurancesStf } from "../../../stf/assurances/applyAssurancesStf";
import { convertToReadableFormat } from "../../../utils";
// import { AssurancesCodec } from "../../../stf/assurances/codecs/AssurancesCodec"; 

describe("Assurances STF conformance", () => {
  const testFiles = [
    "assurance_for_not_engaged_core-1.json",
    // "assurances_with_bad_signature-1.json",
    // "assurances_with_bad_validator_index-1.json",
    // ... all other conformance tests in assurances. 
  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      // 1) Read JSON test vector from file
      const filePath = path.join(
        __dirname,
        "../../../stf/assurances/data",
        fileName
      );
      const rawJson = fs.readFileSync(filePath, "utf8");

      // 2) Parse the top-level shape { input, pre_state, output, post_state }
      const testVector = JSON.parse(rawJson);

      // 3) Convert any "0x..." strings -> Uint8Array for input/pre_state/post_state
      const input = convertToReadableFormat(testVector.input);
      const pre_state = convertToReadableFormat(testVector.pre_state);
      const expectedOutput = testVector.output;
      const expectedPostState = convertToReadableFormat(testVector.post_state);

      // 4) Call the STF
      const { output, postState } = applyAssurancesStf(pre_state, input);

      // 5) Compare results
      expect(output).toEqual(expectedOutput);
      expect(convertToReadableFormat(postState)).toEqual(expectedPostState);
    });
  });
});
