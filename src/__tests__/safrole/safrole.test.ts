import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { SafroleStf } from "../../safrole/types";
import { SafroleStfCodec } from "../../safrole/codecs/SafroleStfCodec";
import { toHex, convertToReadableFormat } from "../../utils";
import { parseSafroleStfJson } from "../../safrole/utils/parseSafroleStfJson"; 

describe("Safrole STF TestCase Codec", () => {

  it("round-trips from JSON => encode => decode => compare", () => {
    // 1) Read JSON
    const jsonPath = path.resolve(__dirname, "../../data/safrole/enact-epoch-change-with-padding-1.json");
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    console.log("Raw JSON:", rawJson);

    // 2) Convert to typed object
    const stfCase: SafroleStf = parseSafroleStfJson(rawJson);

    // 3) Encode
    const encoded = SafroleStfCodec.enc(stfCase);
    console.log("Encoded stfCase hex:", toHex(encoded));

    // 4) Decode
    const decoded = SafroleStfCodec.dec(encoded);
    console.log("Decoded stfCase (readable):", convertToReadableFormat(decoded));

    // 5) Write debugging files
    const outDir = path.resolve(__dirname, "../output/safrole");
    writeFileSync(path.join(outDir, "encodedTestCase.txt"), toHex(encoded));
    writeFileSync(
      path.join(outDir, "decodedTestCase.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 6) Compare
    expect(decoded).toStrictEqual(stfCase);
  });

  it("decodes conformance enact-epoch-change-with-padding-1.bin => re-encodes => exact match", () => {
    // 1) read .bin
    const binPath = path.resolve(__dirname, "../../data/safrole/enact-epoch-change-with-padding-1.bin");
    const rawBin = new Uint8Array(readFileSync(binPath));

    console.log("Conformance binary (hex):", Buffer.from(rawBin).toString("hex"));

    // 2) decode
    const decoded = SafroleStfCodec.dec(rawBin);
    console.log("Decoded conformance stfCase:", convertToReadableFormat(decoded));

    writeFileSync(
      path.resolve(__dirname, "../output/safrole/bin_decodedTestCase.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 3) re-encode
    const reEncoded = SafroleStfCodec.enc(decoded);
    console.log("Re-encoded (hex):", toHex(reEncoded));

    // 4) Compare
    expect(reEncoded).toEqual(rawBin);
  });
});
