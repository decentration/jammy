import { readFileSync, writeFileSync } from "fs";
import path, { parse } from "path";
import { Assurances } from "../../../stf/assurances/types";
import { AssurancesCodec } from "../../../stf/assurances/codecs/AssurancesCodec";
import { toHex, convertToReadableFormat } from "../../../utils";
import { ErrorCode } from "../../../stf/types";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";
import { parseAssurancesStfJson } from "../../../stf/assurances/codecs/utils/parseAssurancesJson";

describe("AssurancesCodec Test", () => {


  const testFiles = [
    "assurance_for_not_engaged_core-1",
    "assurance_with_bad_attestation_parent-1",
     "assurances_for_stale_report-1",
    "assurances_with_bad_signature-1",
    "assurances_with_bad_validator_index-1",
    "assurers_not_sorted_or_unique-1",
    "assurers_not_sorted_or_unique-2",
    "no_assurances-1",
    "no_assurances_with_stale_report-1",
    "some_assurances-1",
  ]

testFiles.forEach((fileName) => {
  it(`should encode and decode Assurances correctly from ${fileName}`, () => {

    const filePath = path.join(path.join(`${JAM_TEST_VECTORS}/assurances`, `${CHAIN_TYPE}`,
      fileName.concat(".json")
      ));
    const raw = JSON.parse(readFileSync(filePath, "utf-8"));

    // Map JSON data to Assurances interface
    const assurances: Assurances = parseAssurancesStfJson(raw);

    // Encode the `Assurances` structure
    const encoded = AssurancesCodec.enc(assurances);
    console.log("Encoded Assurances (hex):", toHex(encoded));

    // Decode back
    const decoded = AssurancesCodec.dec(encoded);

    // Prepare for comparison
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(assurances);

    const outputDir = path.resolve(__dirname, "../../output/stf/assurances");
    writeFileSync(path.join(outputDir, "encodedAssurances.txt"), readableEncoded);
    writeFileSync(
      path.join(outputDir, "decodedAssurances.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.join(outputDir, "originalAssurances.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // Assert equality
    expect(decoded).toStrictEqual(assurances);
  });
});


testFiles.forEach((filename) => {
  it("decodes assurance_for_not_engaged_core-1.bin and verifies round-trip encoding", () => {

    const binPath = path.resolve(path.join(`${JAM_TEST_VECTORS}/assurances`, `${CHAIN_TYPE}`, filename.concat(".bin")));
    
    // Read the binary file as Uint8Array
    const binary = new Uint8Array(readFileSync(binPath));
    // console.log("Conformance binary (hex):", toHex(binary));

    // Decode the binary data into Assurances structure
    const decoded = AssurancesCodec.dec(binary);
    console.log("Decoded Conformance Assurances:", JSON.stringify(convertToReadableFormat(decoded), null, 2));

    // write the decoded data to a JSON file for inspection
    const decodedJsonPath = path.resolve(__dirname, "../../output/stf/assurances/decodedConformanceAssurances.json");
    writeFileSync(decodedJsonPath, JSON.stringify(convertToReadableFormat(decoded), null, 2));

    // Re-encode the decoded data back into binary
    const reEncoded = AssurancesCodec.enc(decoded);
    // console.log("Re-encoded binary (hex):", toHex(reEncoded));

    // write the re-encoded binary to a file for inspection
    const reEncodedBinPath = path.resolve(__dirname, "../../output/stf/assurances/reEncodedConformanceAssurances.bin");
    writeFileSync(reEncodedBinPath, Buffer.from(reEncoded).toString("hex"));

    // Verify that the re-encoded binary matches the original binary data
    expect(reEncoded).toEqual(binary);
  });
});
});

