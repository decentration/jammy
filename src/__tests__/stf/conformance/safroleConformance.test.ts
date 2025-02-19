import fs from "fs";
import path from "path";
import { applySafroleStf } from "../../../safrole/applySafroleStfWIP";
import { convertToReadableFormat } from "../../../utils";
import { deepConvertHexToBytes } from "../../../codecs";

describe("Disputes STF conformance", () => {
  const testFiles = [
    "enact-epoch-change-with-no-tickets-1",
    // "enact-epoch-change-with-no-tickets-2",
    // "enact-epoch-change-with-no-tickets-3",
    // "enact-epoch-change-with-no-tickets-4",
    // "enact-epoch-change-with-padding-1",
    // "publish-tickets-no-mark-1",
    // "publish-tickets-no-mark-2",
    // "publish-tickets-no-mark-3",
    // "publish-tickets-no-mark-4",
    // "publish-tickets-no-mark-5",
    // "publish-tickets-no-mark-6",
    // "publish-tickets-no-mark-7",
    // "publish-tickets-no-mark-8",
    // "publish-tickets-no-mark-9",
    // "publish-tickets-with-mark-1",
    // "publish-tickets-with-mark-2",
    // "publish-tickets-with-mark-3",
    // "publish-tickets-with-mark-4",
    // "publish-tickets-with-mark-5",
    // "skip-epoch-tail-1",
    // "skip-epochs-1"
  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      const filePath = path.join(__dirname, "../../../safrole/data/tiny", fileName.concat('.json'));
      const rawJson = fs.readFileSync(filePath, "utf8");

      const { input, pre_state, output, post_state } = JSON.parse(rawJson);
      const inputBytes = deepConvertHexToBytes(input);
      const pre_stateBytes = deepConvertHexToBytes(pre_state);

      const { output: stfOutput, postState } = applySafroleStf(pre_stateBytes, inputBytes);

      expect(convertToReadableFormat(stfOutput)).toEqual(output);
      expect(convertToReadableFormat(postState)).toEqual(post_state);

    });
  });
});
