import { readFileSync, writeFileSync } from "fs";
import * as fs from "fs";
import * as path from "path";
import { StatsStf } from "../../../stf/statistics/types";
import { StatsStfCodec } from "../../../stf/statistics/codecs/StatsStfCodec";
import { toHex, convertToReadableFormat } from "../../../utils";
import { parseStatsStfJson } from "../../../stf/statistics/utils/parseStatsStfJson";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";


const testFiles = [
  "stats_with_empty_extrinsic-1",
  "stats_with_epoch_change-1",
  "stats_with_some_extrinsic-1",
]

testFiles.forEach((fileName) => {

describe("Stats STF TestCase Codec", () => {
  it("round-trips from JSON => encode => decode => compare", () => {
    // 1) Read JSON


    const jsonPath = path.join(path.join(`${JAM_TEST_VECTORS}/statistics`, `${CHAIN_TYPE}`,
      fileName.concat(".json")
      ));


    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert JSON 
    const stfCase = parseStatsStfJson(rawJson);

    console.log("Stf Case", convertToReadableFormat(stfCase))

    // 3) Encode
    const encoded = StatsStfCodec.enc(stfCase);
    // console.log("Encoded stfCase (hex):", (encoded));
    // console.log("StfCase:", convertToReadableFormat(stfCase));

    // 4) Decode
    const decoded = StatsStfCodec.dec(encoded);

    console.log("Decoded stfCase (readable):", convertToReadableFormat(decoded));

    // 5) Write out debug files
    const outDir = path.resolve(__dirname, "../../output/stf/stats");
    writeFileSync(path.join(outDir, "encodedTestCase.txt"), convertToReadableFormat(encoded));
    writeFileSync(
      path.join(outDir, "decodedTestCase.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 6) Compare
    expect(decoded).toStrictEqual(stfCase);
  });

  // it("decodes conformance stats_with_epoch_change-1.bin => re-encodes => exact match", () => {
  //   // 1) read .bin from the same data directory

  //   const binPath = path.join(path.join(`${JAM_TEST_VECTORS}/statistics`, `${CHAIN_TYPE}`, fileName.concat(".bin")));

  //   const rawBin = new Uint8Array(readFileSync(binPath));

  //   console.log("Conformance binary (hex):", Buffer.from(rawBin).toString("hex"));

  //   // 2) decode
  //   const decoded = StatsStfCodec.dec(rawBin);
  //   console.log(
  //     "Decoded conformance StatsStf:",
  //     convertToReadableFormat(decoded)
  //   );

  //   // debugging output
  //   const outDir = path.resolve(__dirname, "../../output/stf/stats");
  //   writeFileSync(
  //     path.join(outDir, "bin_decodedTestCase.json"),
  //     JSON.stringify(convertToReadableFormat(decoded), null, 2)
  //   );

  //   // 3) re-encode
  //   const reEncoded = StatsStfCodec.enc(decoded);
  //   console.log("Re-encoded (hex):", toHex(reEncoded));

  //   // 4) Compare
  //   expect(reEncoded).toEqual(rawBin);
  // });

});


  describe("StatsStfCodec conformance binary", () => {
    it("decodes a .bin conformance file => re-encodes => must match exactly", () => {
      // 1) read bin file

      const binPath = path.join(path.join(`${JAM_TEST_VECTORS}/statistics`, `${CHAIN_TYPE}`, fileName.concat(".bin"))
      );
      const rawBin = new Uint8Array(readFileSync(binPath));
      console.log("Stats bin (hex):", toHex(rawBin));
  
      // 2) decode
      const decoded: StatsStf = StatsStfCodec.dec(rawBin);
  
      // 3) debug info => JSON
      const outDir = path.resolve(__dirname, "../../output/stf/stats");
      writeFileSync(
        path.join(outDir, "decodedStatsConformance.json"),
        JSON.stringify(convertToReadableFormat(decoded), null, 2)
      );
  
      // 4) re-encode
      const reEncoded = StatsStfCodec.enc(decoded);
      console.log("Re-encoded (hex):", toHex(reEncoded));
  
      // 5) write re encoded bin
      writeFileSync(
        path.join(outDir, "reEncodedStatsConformance.bin"),
       (Buffer.from(reEncoded).toString("hex"))
      );
  
      // 6) comp
      expect(reEncoded).toEqual(rawBin);
    });
  });


// /// it compare byye arrays
//   it("decodes conformance bin => re-encodes => exact match", () => {
//     // 1) read .bin from the same data directory
//     const binPath = path.resolve(
//       __dirname,
//       "./../../../stf/statistics/data/full/outputBin.txt"
//     );
//     const rawBin = new Uint8Array(readFileSync(binPath));

//     const binPath2 = path.resolve(
//       __dirname,
//       "./../../output/stf/stats/encodedTestCase.txt"
//     );
//     const rawBin2 = new Uint8Array(readFileSync(binPath2));

//     compareFilesByteByByte(binPath, binPath2);


//  });


});

/**
 * compareFilesByteByByte
 * Reads two files entirely into memory, then does a byte-by-byte comparison.
 * - Logs every mismatch with the index, plus hex representation of both bytes
 * - Logs total mismatch count
 * - Also checks if file lengths differ
 */
function compareFilesByteByByte(pathA: string, pathB: string): void {
  const fileA = fs.readFileSync(pathA);
  const fileB = fs.readFileSync(pathB);

  if (fileA.length !== fileB.length) {
    console.log(`Length mismatch: A=${fileA.length}, B=${fileB.length}`);
  }

  const maxLen = Math.max(fileA.length, fileB.length);
  let diffCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const aVal = i < fileA.length ? fileA[i] : undefined; 
    const bVal = i < fileB.length ? fileB[i] : undefined; 

    if (aVal !== bVal) {
      diffCount++;
      console.log(
        `Mismatch at byte #${i}: A=0x${(aVal ?? 0)
          .toString(16)
          .padStart(2, "0")} B=0x${(bVal ?? 0)
          .toString(16)
          .padStart(2, "0")}`
      );
    }
  }

  console.log(diffCount === 0 && fileA.length === fileB.length
      ? "Files match exactly (no differences)."
      : `Total differences found: ${diffCount}`
  )
};