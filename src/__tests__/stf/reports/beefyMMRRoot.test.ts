import fs from "fs";
import path from "path";
import { superPeaks } from "../../../mmr/superPeaks";
import { hexStringToBytes } from "../../../codecs/utils";
import { arrayEqual } from "../../../utils";

describe("Beefy MMR Root Computation", () => {
  it("computes the correct MMR root from mmrPeaksExample-1.json", () => {
    // 1) Load JSON
    const fileName = "mmrPeaks.json";  
    const filePath = path.join(__dirname, fileName);
    const raw = fs.readFileSync(filePath, "utf8");
    const testVec = JSON.parse(raw);
    console.log("testVec:", testVec);

    // 2) Parse peaks
    const peaks = testVec?.peaks.map((hexOrNull: string) => {
        console.log("peaks:", hexOrNull);   
      if (!hexOrNull) return null; 
      return new Uint8Array(hexStringToBytes(hexOrNull));
    }) as (Uint8Array|null)[];

    // 3) Compute
    
    const computedRoot = superPeaks(peaks);

    // 4) Compare with expected
    const expectedHex = testVec.expected_beefy_root; 
    console.log("expectedHex:", expectedHex);
    const expectedBytes = new Uint8Array(hexStringToBytes(expectedHex));

    const match = arrayEqual(computedRoot, expectedBytes);
    console.log("computedRoot:", computedRoot, "expected:", expectedBytes);
    expect(match).toBe(true);
  });
});
