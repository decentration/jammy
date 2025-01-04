import { readFileSync } from "fs";
import path from "path";
import { Culprit } from "../../types/types";
import { CulpritCodec } from "../../codecs";
import { DiscriminatorCodec } from "../../codecs/DiscriminatorCodec";

describe("CulpritCodec tests", () => {
  it("encodes/decodes array of culprits (with length prefix)", () => {
    // 1) Load culprits JSON, e.g. in ./data/disputes/culprits.json
    const jsonPath = path.resolve(__dirname, "../../data/disputes/culprits.json");
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert each JSON object to Culprit
    const culprits: Culprit[] = rawJson.map((c: any) => ({
      target: Uint8Array.from(Buffer.from(c.target.slice(2), "hex")),
      key: Uint8Array.from(Buffer.from(c.key.slice(2), "hex")),
      signature: Uint8Array.from(Buffer.from(c.signature.slice(2), "hex")),
    }));

    // 3) Use DiscriminatorCodec(CulpritCodec)
    const culpritsArrayCodec = DiscriminatorCodec(CulpritCodec);

    // 4) Encode
    const encoded = culpritsArrayCodec.enc(culprits);

    // 5) Decode
    const decoded = culpritsArrayCodec.dec(encoded);

    // 6) Check round-trip
    expect(decoded).toStrictEqual(culprits);

    // console.log("Encoded culprits hex:", Buffer.from(encoded).toString("hex"));
  });
});
