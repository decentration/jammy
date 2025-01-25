import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Authorizations } from "../../../stf/authorizations/types";
import { AuthorizationsCodec } from "../../../stf/authorizations/codecs/AuthorizationsCodec";
import { toHex, convertToReadableFormat, toHexToggle } from "../../../utils";
import { toBytes } from "../../../codecs";

describe("AuthorizationsCodec Test", () => {
  it("should encode and decode Authorizations from JSON test vector", () => {
    // 1) Load test data
    const jsonPath = path.resolve(
      __dirname,
      "../../../stf/authorizations/data/progress_authorizations-2.json"
    );
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert JSON into the Authorizations shape with Uint8Array fields

    // a) Convert input slot (simple number) and core authorizers
    const inputCoreAuthorizers = rawJson.input.auths.map((a: any) => ({
      core: a.core,
      auth_hash: toBytes(a.auth_hash),
    }));

    // b) Build the full "Authorizations" object
    const authorizations: Authorizations = {
      input: {
        slot: rawJson.input.slot,
        auths: inputCoreAuthorizers,
      },
      pre_state: {
        // Each auth_pools item is an array of 0..8 32-byte items
        auth_pools: rawJson.pre_state.auth_pools.map((pool: any[]) => 
          pool.map((h: string) => toBytes(h))
        ),
        // Each auth_queues item is an array of EXACTLY 80 32-byte items
        auth_queues: rawJson.pre_state.auth_queues.map((queue: any[]) =>
          queue.map((h: string) => toBytes(h))
        ),
      },
      output: null,
      post_state: {
        auth_pools: rawJson.post_state.auth_pools.map((pool: any[]) =>
          pool.map((h: string) => toBytes(h))
        ),
        auth_queues: rawJson.post_state.auth_queues.map((queue: any[]) =>
          queue.map((h: string) => toBytes(h))
        ),
      },
    };

    // 3) Encode 
    const encoded = AuthorizationsCodec.enc(authorizations);
    console.log("Encoded Authorizations (hex):", toHexToggle(encoded, false));

    // 4) Decode back
    const decoded = AuthorizationsCodec.dec(encoded);

    // 5) Compare
    // convert both to a "readable" format (hex strings instead of Uint8Array)
    const readableEncoded = toHexToggle(encoded, false);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(authorizations);

    const outputDir = path.resolve(__dirname, "../../output/stf/authorizations");
    writeFileSync(path.join(outputDir, "encodedAuthorizations.txt"), readableEncoded);
    writeFileSync(
      path.join(outputDir, "decodedAuthorizations.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.join(outputDir, "originalAuthorizations.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // 6) Final assertion
    // toStrictEqual works if all arrays align. 
    expect(decoded).toStrictEqual(authorizations);
  });

  it("decodes some_authorizations-1.bin and verifies round-trip encoding", () => {
    // 1) Define the path to the binary test file
    const binPath = path.resolve(
      __dirname,
      "../../../stf/authorizations/data/progress_authorizations-1.bin"
    );
    const binary = new Uint8Array(readFileSync(binPath));
    console.log("Conformance binary (hex):", toHex(binary));

    // 2) Decode the binary data -> Authorizations structure
    const decoded = AuthorizationsCodec.dec(binary);
    console.log(
      "Decoded Conformance Authorizations:",
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 3)  write the decoded data to JSON for inspection
    const decodedJsonPath = path.resolve(
      __dirname,
      "../../output/stf/authorizations/decodedConformanceAuthorizations.json"
    );
    writeFileSync(
      decodedJsonPath,
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    // 4) Re-encode
    const reEncoded = AuthorizationsCodec.enc(decoded);
    console.log("Re-encoded binary (hex):", toHex(reEncoded));

    // 5) Write re-encoded .bin to a file
    const reEncodedBinPath = path.resolve(
      __dirname,
      "../../output/stf/authorizations/reEncodedConformanceAuthorizations.bin"
    );
    writeFileSync(reEncodedBinPath, Buffer.from(reEncoded));

    // 6) Compare original and re-encoded
    expect(reEncoded).toEqual(binary);
  });
});

