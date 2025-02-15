import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Dispute } from "../../types/types";
import { DisputeCodec } from "../../codecs";

// Helper function to convert Uint8Array to hex string
const toHex = (uint8: Uint8Array): string =>
  "0x" + Array.from(uint8).map((b) => b.toString(16).padStart(2, "0")).join("");

// Recursive function to convert all Uint8Array in an object to hex strings
const convertToReadableFormat = (obj: any): any => {
  if (obj instanceof Uint8Array) {
    return toHex(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(convertToReadableFormat);
  }
  if (typeof obj === "object" && obj !== null) {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertToReadableFormat(value);
    }
    return result;
  }
  return obj;
};

describe("DisputeCodec test", () => {
  it("encodes/decodes an entire dispute JSON (verdicts, culprits, faults)", () => {
    // Load the JSON
    const jsonPath = path.resolve(__dirname, "../../data/disputes/disputes_extrinsic.json");
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // Convert JSON into Dispute structure
    const dispute: Dispute = {
      verdicts: rawJson.verdicts.map((vd: any) => ({
        target: Uint8Array.from(Buffer.from(vd.target.slice(2), "hex")),
        age: vd.age,
        votes: vd.votes.map((v: any) => ({
          vote: v.vote,
          index: v.index,
          signature: Uint8Array.from(Buffer.from(v.signature.slice(2), "hex")),
        })),
      })),
      culprits: rawJson.culprits.map((cp: any) => ({
        target: Uint8Array.from(Buffer.from(cp.target.slice(2), "hex")),
        key: Uint8Array.from(Buffer.from(cp.key.slice(2), "hex")),
        signature: Uint8Array.from(Buffer.from(cp.signature.slice(2), "hex")),
      })),
      faults: rawJson.faults.map((ft: any) => ({
        target: Uint8Array.from(Buffer.from(ft.target.slice(2), "hex")),
        vote: ft.vote,
        key: Uint8Array.from(Buffer.from(ft.key.slice(2), "hex")),
        signature: Uint8Array.from(Buffer.from(ft.signature.slice(2), "hex")),
      })),
    };

    // Encode the dispute
    const encoded = DisputeCodec.enc(dispute);

    // Decode the dispute
    const decoded = DisputeCodec.dec(encoded);

    // Convert to human-readable format
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(dispute);

    // Write results to files for debugging
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/disputes/encoded_dispute.txt"),
      readableEncoded
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/disputes/decoded_dispute.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/disputes/original_dispute.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // Validate round-trip encoding/decoding
    expect(decoded).toStrictEqual(dispute);
  });
});


describe("DisputeCodec conformance .bin", () => {
  it("decodes an official .bin => re-encodes => must match exactly", () => {
    // 1) read official .bin file
    const binPath = path.resolve(__dirname, "../../data/disputes/disputes_extrinsic.bin");
    const binData = readFileSync(binPath);
    const binUint8 = new Uint8Array(binData);

    console.log("Original bin (hex) =", toHex(binUint8));

    // 2) decode
    const decoded: Dispute = DisputeCodec.dec(binUint8);

    // 3) re-encode
    const reEncoded = DisputeCodec.enc(decoded);
    console.log("Re-encoded bin (hex) =", toHex(reEncoded));

    // 4) compare
    expect(reEncoded).toEqual(binUint8);
  });
});