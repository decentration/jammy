import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Reports } from "../../../stf/reports/types";    
import { ReportsCodec } from "../../../stf/reports/codecs/ReportsCodec"; 
import { toHex, convertToReadableFormat } from "../../../utils";
import { convertHexFieldsToBytes, toUint8Array, deepConvertHexToBytes } from "../../../codecs";


describe("ReportsCodec", () => {
  it("encodes/decodes an entire Reports object from JSON", () => {
    // 1) Load test vector JSON
    const jsonPath = path.resolve(__dirname, "../../../stf/reports/data/tiny/bad_code_hash-1.json");
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert all "0x..." => Uint8Array
    
    const reportsObj = deepConvertHexToBytes(rawJson) as Reports;

    console.log("reportsObj:", rawJson, reportsObj);

    // 3) Encode
    const encoded = ReportsCodec.enc(reportsObj);

    // 4) Decode
    const decoded = ReportsCodec.dec(encoded);

    // 5) Convert for debug
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(reportsObj);

    const outDir = path.resolve(__dirname, "../../output/stf/reports");
    writeFileSync(path.join(outDir, "encodedReports.hex"), readableEncoded);
    writeFileSync(
      path.join(outDir, "decodedReports.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.join(outDir, "originalReports.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    console.log("readableDecoded:", readableDecoded.input.guarantees);
    // 6) Validate round-trip
    expect(readableDecoded).toStrictEqual(readableOriginal);
  });
});
