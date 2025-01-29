import fs from "fs";
import path from "path";
import { applyReportsStf } from "../../../../stf/reports/applyReportsStf";
import { convertToReadableFormat } from "../../../../utils";

describe("Reports STF - anchor_not_recent", () => {
  it("should fail with anchor_not_recent-1.json", () => {
    const filePath = path.join(__dirname, "../../../../stf/reports/data/tiny", "anchor_not_recent-1.json");
    const rawJson = fs.readFileSync(filePath, "utf8");
    const testVector = JSON.parse(rawJson);
    const { input, pre_state, output, post_state } = testVector;

    const { output: actualOutput, postState: actualPostState } = applyReportsStf(pre_state, input);

    console.log("actualOutput", actualOutput);

    expect(actualOutput).toEqual(output);
    expect(convertToReadableFormat(actualPostState)).toEqual(pre_state); 
  });
});