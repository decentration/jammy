import { readFileSync } from "fs";
import path from "path";
import { Fault, FaultCodec} from "../../types/types";
import { DiscriminatorCodec } from "../../codecs";

describe("FaultCodec tests", () => {
  it("encodes/decodes array of faults (with length prefix)", () => {
    // 1) Load faults JSON, e.g. in ./data/disputes/faults.json
    const jsonPath = path.resolve(__dirname, "../../data/disputes/faults.json");
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert JSON to Fault
    const faults: Fault[] = rawJson.map((f: any) => ({
      target: Uint8Array.from(Buffer.from(f.target.slice(2), "hex")),
      vote: f.vote,
      key: Uint8Array.from(Buffer.from(f.key.slice(2), "hex")),
      signature: Uint8Array.from(Buffer.from(f.signature.slice(2), "hex")),
    }));

    // 3) Use DiscriminatorCodec(FaultCodec)
    const faultsArrayCodec = DiscriminatorCodec(FaultCodec);

    // 4) Encode
    const encoded = faultsArrayCodec.enc(faults);

    // 5) Decode
    const decoded = faultsArrayCodec.dec(encoded);

    // 6) Check round-trip
    expect(decoded).toStrictEqual(faults);

    // console.log("Encoded faults hex:", Buffer.from(encoded).toString("hex"));
  });
});
