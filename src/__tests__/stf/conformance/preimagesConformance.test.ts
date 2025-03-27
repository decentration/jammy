import fs from "fs";
import path from "path";
import { convertToReadableFormat } from "../../../utils";
import { applyPreimagesStf } from "../../../stf/preimages/applyPreimagesStf";
import { deepConvertHexToBytes } from "../../../codecs";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

describe("Safrole STF conformance", () => {
  const testFiles = [
    "preimage_needed-1",
    "preimage_needed-2",
    "preimage_not_needed-1",
    "preimage_not_needed-2",
    "preimages_order_check-1",
    "preimages_order_check-2",
    "preimages_order_check-3",
    "preimages_order_check-4"

  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      
      const filePath = path.join(`${JAM_TEST_VECTORS}/preimages`, 'data', fileName.concat('.json'));
      const rawJson = fs.readFileSync(filePath, "utf8");

      const { input, pre_state, output, post_state } = JSON.parse(rawJson);
      const inputBytes = deepConvertHexToBytes(input);
      const pre_stateBytes = deepConvertHexToBytes(pre_state);

      const { output: stfOutput, postState } = applyPreimagesStf(pre_stateBytes, inputBytes);

      expect(convertToReadableFormat(stfOutput)).toEqual(output);
      expect(convertToReadableFormat(postState)).toEqual(post_state);

    });
  });
});
