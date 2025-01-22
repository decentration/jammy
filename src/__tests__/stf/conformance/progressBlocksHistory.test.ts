import fs from "fs";
import path from "path";
import { applyHistoryStf } from "../../../stf/history/applyHistoryStf";
import { convertToReadableFormat, toHex } from "../../../utils"; 

describe("History STF conformance", () => {
  const testFiles = [
    "progress_blocks_history-1.json",
    "progress_blocks_history-2.json",
    "progress_blocks_history-3.json",
    "progress_blocks_history-4.json",
  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      // 1) read JSON
      const filePath = path.join(
        __dirname,
        "../../../stf/history/data",
        fileName
      );
      const rawJson = fs.readFileSync(filePath, "utf8");

      const { input, pre_state, output, post_state } = JSON.parse(rawJson);


      // console.log("Raw JSON:", post_state);
      // 2) convert all "0x..." strings => Uint8Arrays

      // console.log("Converted testVector:", post_state, );
      // Now testVector is a nested structure but with Uint8Array fields.

      // 3) run STF
      const { output: stfOutput, postState } = applyHistoryStf(
        pre_state,
        input
      );

      // log the final postState hex freindly format
      console.log("Computed postState hex:\n", 
        JSON.stringify(convertToReadableFormat(postState), null, 2));

      // 4) compare
      const readablePostState = convertToReadableFormat(postState);
      const readableExpectedPostState = JSON.stringify(convertToReadableFormat(post_state), null, 2);
      
      console.log("Expected postState hex:\n", readableExpectedPostState);
      expect(stfOutput).toEqual(output);
      expect(readablePostState).toEqual(post_state);

    });
  });
});