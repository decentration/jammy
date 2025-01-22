import fs from "fs";
import path from "path";
import { applyAssurancesStf } from "../../../stf/assurances/applyAssurancesStf";
import { convertToReadableFormat } from "../../../utils";
import { AssurancesCodec } from "../../../stf/assurances/codecs/AssurancesCodec";

describe("Assurances STF conformance", () => {
  const testFiles = [
    "assurance_for_not_engaged_core-1.json",
    "assurances_with_bad_signature-1.json",
    "assurances_with_bad_validator_index-1.json",
     //...
  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      // 1) read JSON
      const filePath = path.join(
        __dirname,
        "../../../stf/assurances/data",
        fileName
      );
      const rawJson = fs.readFileSync(filePath, "utf8");
      // parse the top-level shape: { input, pre_state, output, post_state }
      const testVector = JSON.parse(rawJson);

      //  convert hex "0x..." => Uint8Array
      const input = convertToReadableFormat(testVector.input);
      const pre_state = convertToReadableFormat(testVector.pre_state);
      const expectedOutput = testVector.output;
      const expectedPostState = convertToReadableFormat(testVector.post_state);

      // 2) apply STF
      const { output, postState } = applyAssurancesStf(
        pre_state,
        input
      );

      // 3) compare
      expect(output).toEqual(expectedOutput);
      expect(convertToReadableFormat(postState)).toEqual(expectedPostState);
    });
  });
});
