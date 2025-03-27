import { readFileSync, writeFileSync } from "fs";
import * as fs from "fs";
import * as path from "path";
import { PreimagesStf } from "../../../stf/preimages/types";
import { PreimagesStfCodec } from "../../../stf/preimages/codecs/PreimagesStfCodec";
import { toHex, convertToReadableFormat } from "../../../utils";
import { parsePreimagesStfJson } from "../../../stf/preimages/utils/parsePreimagesStfJson";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

describe("Preimages STF TestCase Codec", () => {
  it("round-trips from JSON => encode => decode => compare", () => {
    // 1) Read JSON
    
    const jsonPath = path.join(
      `${JAM_TEST_VECTORS}/preimages`, "data", `preimages_order_check-4.json`
    );
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert JSON 
    const stfCase = parsePreimagesStfJson(rawJson);

    // 3) Encode
    const encoded = PreimagesStfCodec.enc(stfCase);
    // console.log("Encoded stfCase (hex):", (encoded));
    // console.log("StfCase:", convertToReadableFormat(stfCase));

    // 4) Decode
    const decoded = PreimagesStfCodec.dec(encoded);

    console.log("Decoded stfCase (readable):", convertToReadableFormat(decoded));

    // 5) Debug files
    const outDir = path.resolve(__dirname, "../../output/stf/Preimages");
    writeFileSync(path.join(outDir, "encodedTestCase.txt"), convertToReadableFormat(encoded));
    writeFileSync(
      path.join(outDir, "decodedTestCase.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 6) Compare
    expect(decoded).toStrictEqual(stfCase);
  });

  it("decodes conformance preimages_order_chec-4.bin => re-encodes => exact match", () => {
    // 1) read .bin from the same data directory
    const binPath = path.join(
      `${JAM_TEST_VECTORS}/preimages`, "data", `preimages_order_check-4.bin`
    );
    const rawBin = new Uint8Array(readFileSync(binPath));

    console.log("Conformance binary (hex):", Buffer.from(rawBin).toString("hex"));

    // 2) decode
    const decoded = PreimagesStfCodec.dec(rawBin);
    console.log(
      "Decoded conformance PreimagesStf:",
      convertToReadableFormat(decoded)
    );

    // debugging output
    const outDir = path.resolve(__dirname, "../../output/stf/Preimages");
    writeFileSync(
      path.join(outDir, "bin_decodedTestCase.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 3) re-encode
    const reEncoded = PreimagesStfCodec.enc(decoded);
    console.log("Re-encoded (hex):", toHex(reEncoded));

    // 4) Compare
    expect(reEncoded).toEqual(rawBin);
  });
}
);