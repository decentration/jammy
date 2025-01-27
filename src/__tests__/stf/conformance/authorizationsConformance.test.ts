import fs from "fs";
import path from "path";
import { applyAuthorizationsStf } from "../../../stf/authorizations/applyAuthorizationsStf";
import { convertToReadableFormat } from "../../../utils";

describe("Authorizations STF conformance", () => {

  // conformance test files
  const testFiles = [
    "progress_authorizations-1.json",
    "progress_authorizations-2.json",
    "progress_authorizations-3.json",
  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      // 1) Read JSON test vector
      const filePath = path.join(
        __dirname,
        "../../../stf/authorizations/data",
        fileName
      );
      const rawJson = fs.readFileSync(filePath, "utf8");

      // 2) Parse top-level shape: { input, pre_state, output, post_state }
      const testVector = JSON.parse(rawJson);

      // 3) Extract fields from the test vector
      const input = testVector.input;
      const pre_state = testVector.pre_state;
      const expectedOutput = testVector.output;
      const expectedPostState = testVector.post_state;

      // 4) The Main Event... Apply the Authorizations STF
      const { output, postState } = applyAuthorizationsStf(pre_state, input);

      // 5) Compare results
      expect(output).toEqual(expectedOutput);
      expect(convertToReadableFormat(postState)).toEqual(
        convertToReadableFormat(expectedPostState)
      );
    });
  });
});
