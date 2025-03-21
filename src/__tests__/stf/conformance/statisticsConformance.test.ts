import fs from "fs";
import path from "path";
import { applyStatsStf } from "../../../stf/statistics/applyStatsStf";
import { StatsStfCodec } from "../../../stf/statistics/codecs/StatsStfCodec"; 
import { deepConvertHexToBytes, toUint8Array } from "../../../codecs/utils";
import { convertToReadableFormat } from "../../../utils";
import { CHAIN_TYPE } from "../../../consts";

describe("Statistics STF conformance", () => {
  const testFiles = [
    "stats_with_some_extrinsic-1",
    "stats_with_empty_extrinsic-1",
    "stats_with_epoch_change-1",
  ];

  testFiles.forEach((fileName) => {
    it(`should pass ${fileName}`, () => {
      const filePath = path.join(__dirname, `../../../stf/statistics/data/${CHAIN_TYPE}/`, "", fileName + ".json");
      const rawJson = fs.readFileSync(filePath, "utf8");
      const { input, pre_state, output, post_state } = JSON.parse(rawJson);

      const inputBytes = deepConvertHexToBytes(input);
      const pre_stateBytes = deepConvertHexToBytes(pre_state);
            
      // 1) apply the STF
      const { output: stfOutput, postState } = applyStatsStf(pre_stateBytes, inputBytes);

        // console.log("Actual postState:", postState);
      // 2) compare with expected
      expect(convertToReadableFormat(stfOutput)).toEqual(output);
      expect(convertToReadableFormat(postState)).toEqual(post_state);

      // 3) round-trip encode-decode
    
      const stf = { input, pre_state, output: stfOutput, post_state: postState };

      // console.log("STF:", stf);
      // const encoded = StatsStfCodec.enc(stf);
      // console.log("Encoded STF:", encoded);
      // const decoded = StatsStfCodec.dec(encoded);
      // expect(decoded).toStrictEqual(stf);
    
    });
  });
});
