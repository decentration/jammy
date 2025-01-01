import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { HistoryInput } from "../../../stf/types"; 
import { HistoryInputCodec } from "../../../stf/history/codecs";
import { toHex, convertToReadableFormat } from "../../../utils"; 

describe("HistoryInputCodec test", () => {
  it("encodes/decodes input data from JSON", () => {
    const jsonPath = path.resolve(__dirname, "../../../stf/history/data/input.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    const input: HistoryInput = {
      header_hash: Uint8Array.from(Buffer.from(raw.header_hash.slice(2), "hex")),
      parent_state_root: Uint8Array.from(Buffer.from(raw.parent_state_root.slice(2), "hex")),
      accumulate_root: Uint8Array.from(Buffer.from(raw.accumulate_root.slice(2), "hex")),
      work_packages: raw.work_packages.map((wp: any) => ({
        hash: Uint8Array.from(Buffer.from(wp.hash.slice(2), "hex")),
        exports_root: Uint8Array.from(Buffer.from(wp.exports_root.slice(2), "hex")),
      })),
    };
    const encoded = HistoryInputCodec.enc(input);
    console.log("Encoded Input (hex):", toHex(encoded));
    const decoded = HistoryInputCodec.dec(encoded);

    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(input);

    const outputDir = path.resolve(__dirname, "../../output/stf/history/input");
    writeFileSync(path.join(outputDir, "encodedInput.txt"), readableEncoded);
    writeFileSync(path.join(outputDir, "decodedInput.json"), JSON.stringify(readableDecoded, null, 2));
    writeFileSync(path.join(outputDir, "originalInput.json"), JSON.stringify(readableOriginal, null, 2));

    expect(decoded).toStrictEqual(input);
  });
});
