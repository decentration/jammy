import fs, { readFileSync, writeFileSync } from "fs";
import path from "path";
import { deepConvertHexToBytes } from "../../codecs";
import { convertToReadableFormat, toHex } from "../../utils";
import { describe, it, expect } from "bun:test";
import { Codec } from "scale-ts";

export enum TestMode {
  JSON_ONLY = "json-only",
  BIN_ONLY = "bin-only",
  BOTH = "both",
}

/**
 * Creates a generic test suite for roundtrip testing and conformance.
 * 
 * We pass in:
 *  - codec: The codec with enc/dec methods
 *  - typeName: A friendly type name for describe/it blocks
 *  - testVectorsDir: Where the ".json" and ".bin" test vectors are located
 *  - outDir: Where we place debug output
 *  - testFiles: The list of test file names (without .json/.bin extension)
 */
export function createCodecTestSuite<T>(
  codec: Codec<T>,
  typeName: string,
  testVectorsDir: string,
  outDir: string,
  testFiles: string[],
  parseJsonFn?: (rawJson: any) => T,
  testMode: TestMode = TestMode.BOTH


) {
  testFiles.forEach((fileName) => {
    describe(`${typeName} Codec for "${fileName}"`, () => {
      if (testMode === TestMode.JSON_ONLY || testMode === TestMode.BOTH) {

      it(`encodes/decodes an entire ${typeName} object from JSON`, () => {
        // 1) Build the JSON file path
        const filePath = path.join(testVectorsDir, `${fileName}.json`);
        // 2) Parse raw JSON
        const rawJson = JSON.parse(readFileSync(filePath, "utf-8"));

        // 3) Convert json...
        const inputObj: T = parseJsonFn
        ? parseJsonFn(rawJson)
        : (deepConvertHexToBytes(rawJson) as T);
        
        // 4) Encode with the provided codec
        const encoded = codec.enc(inputObj);

        // 5) Decode again
        const decoded = codec.dec(encoded);

        // 6) Make human readable for debugging
        const readableEncoded = toHex(encoded);
        const readableDecoded = convertToReadableFormat(decoded);
        const readableOriginal = convertToReadableFormat(inputObj);

        // Ensure output directory exists
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }

        // 7) Write debug info
        writeFileSync(path.join(outDir, `encoded-${fileName}.hex`), readableEncoded);
        writeFileSync(
          path.join(outDir, `decoded-${fileName}.json`),
          JSON.stringify(readableDecoded, null, 2),
        );
        writeFileSync(
          path.join(outDir, `original-${fileName}.json`),
          JSON.stringify(readableOriginal, null, 2),
        );

        // 8) Validate that the original and round-tripped decode match
        expect(readableDecoded).toStrictEqual(readableOriginal);
      });
    }
    if (testMode === TestMode.BIN_ONLY || testMode === TestMode.BOTH) {

      it("decodes a .bin conformance file => re-encodes => must match exactly", () => {
        // 1) Build the .bin file path
        const binPath = path.join(testVectorsDir, `${fileName}.bin`);
        const rawBin = new Uint8Array(readFileSync(binPath));
        
        // 2) Decode
        const decoded = codec.dec(rawBin);

        // 3) Write debug info => JSON
        if (!fs.existsSync(outDir)) {
          fs.mkdirSync(outDir, { recursive: true });
        }
        writeFileSync(
          path.join(outDir, `decodedConformance-${fileName}.json`),
          JSON.stringify(convertToReadableFormat(decoded), null, 2),
        );

        // 4) Re-encode
        const reEncoded = codec.enc(decoded);

        // 5) Write re-encoded bin as hex for debugging
        writeFileSync(
          path.join(outDir, `reEncodedConformance-${fileName}.bin`),
          Buffer.from(reEncoded).toString("hex"),
        );

        // 6) Validate they match exactly
        expect(reEncoded).toEqual(rawBin);
      });
    }
    });
  });
}


/*--- EXAMPLE USAGE ---
import path from "path";
import { Reports } from "../../../stf/reports/types";
import { ReportsCodec } from "../../../stf/reports/codecs/ReportsCodec";
import { createCodecTestSuite } from "../../../test-utils/createCodecTestSuite";
import { CHAIN_TYPE, JAM_TEST_VECTORS } from "../../../consts";

const testFiles = [
  "anchor_not_recent-1",
  "bad_beefy_mmr-1",
  "bad_code_hash-1",
  "wrong_assignment-1",
];

describe("Reports Codec Tests", () => {
  const testVectorsDir = path.join(JAM_TEST_VECTORS, "reports", CHAIN_TYPE);
  const outDir = path.resolve(__dirname, "../../output/stf/reports");

  createCodecTestSuite<Reports>(
    ReportsCodec,      // Our codec
    "Reports",         // name
    testVectorsDir,    // path to JSON/.bin test vectors
    outDir,            // output directory for debug
    testFiles,         // array of test file names
  );
});
-----------------*/