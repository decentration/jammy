import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { StatsStf } from "../../../stf/statistics/types";
import { StatsStfCodec } from "../../../stf/statistics/codecs/StatsStfCodec";
import { toHex, convertToReadableFormat } from "../../../utils";
import { parseStatsStfJson } from "../../../stf/statistics/utils/parseStatsStfJson";

describe("Stats STF TestCase Codec", () => {
  it("round-trips from JSON => encode => decode => compare", () => {
    // 1) Read JSON
    const jsonPath = path.resolve(
      __dirname,
      "../../../stf/statistics/data/tiny/stats_with_some_extrinsic-1.json"
    );
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert JSON 
    const stfCase = parseStatsStfJson(rawJson);

    // 3) Encode
    const encoded = StatsStfCodec.enc(stfCase);
    // console.log("Encoded stfCase (hex):", (encoded));
    // console.log("StfCase:", convertToReadableFormat(stfCase));

    // 4) Decode
    const decoded = StatsStfCodec.dec(encoded);

    // console.log("Decoded stfCase (readable):", convertToReadableFormat(decoded));

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

  it("decodes conformance stats_with_some_extrinsic-1.bin => re-encodes => exact match", () => {
    // 1) read .bin from the same data directory
    const binPath = path.resolve(
      __dirname,
      "./../../../stf/statistics/data/tiny/stats_with_some_extrinsic-1.bin"
    );
    const rawBin = new Uint8Array(readFileSync(binPath));

    console.log("Conformance binary (hex):", Buffer.from(rawBin).toString("hex"));

    // 2) decode
    const decoded = StatsStfCodec.dec(rawBin);
    console.log(
      "Decoded conformance StatsStf:",
      convertToReadableFormat(decoded)
    );

    // debugging output
    const outDir = path.resolve(__dirname, "../../output/stf/stats");
    writeFileSync(
      path.join(outDir, "bin_decodedTestCase.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 3) re-encode
    const reEncoded = StatsStfCodec.enc(decoded);
    console.log("Re-encoded (hex):", toHex(reEncoded));

    // 4) Compare
    expect(reEncoded).toEqual(rawBin);
  });
 });

 