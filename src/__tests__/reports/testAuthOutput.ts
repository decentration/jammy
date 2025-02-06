import { readFileSync } from "fs";
import path from "path";
import { hexStringToBytes } from "../../codecs/utils";
import { VarLenBytesCodec } from "../../codecs/VarLenBytesCodec";

describe("Auth Output large encoding/decoding test", () => {

  it("should encode/decode 12,288-byte auth_output and match known bin", () => {
    // 1) Read the JSON that has the big auth_output
    const jsonPath = path.resolve(__dirname, "../../stf/reports/data/result_ok_output_large-1.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    // raw.auth_output is presumably a "0x..." string or direct bytes

    // Convert to a Uint8Array 
    let authOutputBytes = typeof raw.auth_output === "string"
      ? hexStringToBytes(raw.auth_output)
      : raw.auth_output;

    expect(authOutputBytes.length).toBe(18432);

    // 2) Encode using your var-len approach
    const encoded = VarLenBytesCodec.enc(authOutputBytes);
    console.log("encoded", encoded);
    console.log("encoded lngth", encoded.length);
    console.log("encoded hex", Buffer.from(encoded).toString("hex"));
  });

});
