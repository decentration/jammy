import { PackageSpec, PackageSpecCodec } from "../../types/types";
import { readFileSync, writeFileSync } from "fs";
import path from "path";

function toHex(uint8: Uint8Array): string {
  return "0x" + Buffer.from(uint8).toString("hex");
}

function convertToReadableFormat(obj: any): any {
  if (obj instanceof Uint8Array) {
    return toHex(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(convertToReadableFormat);
  } else if (typeof obj === "object" && obj !== null) {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = convertToReadableFormat(v);
    }
    return result;
  }
  return obj;
}

describe("PackageSpecCodec test", () => {
  it("encodes/decodes a PackageSpec from JSON", () => {
    // 1) Load JSON (or inline data)
    const jsonPath = path.resolve(__dirname, "../../data/guarantees/package_spec.json");
    // e.g. stored exactly as the JSON snippet you provided
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert to typed PackageSpec
    const packageSpec: PackageSpec = {
      hash: Uint8Array.from(Buffer.from(raw.hash.slice(2), "hex")),
      length: raw.length,
      erasure_root: Uint8Array.from(Buffer.from(raw.erasure_root.slice(2), "hex")),
      exports_root: Uint8Array.from(Buffer.from(raw.exports_root.slice(2), "hex")),
      exports_count: raw.exports_count,
    };

    // 3) Encode
    const encoded = PackageSpecCodec.enc(packageSpec);

    // 4) Decode
    const decoded = PackageSpecCodec.dec(encoded);

    // 5) Compare fields individually to handle Uint8Array
    expect(decoded.hash).toEqual(packageSpec.hash);
    expect(decoded.length).toBe(packageSpec.length);
    expect(decoded.erasure_root).toEqual(packageSpec.erasure_root);
    expect(decoded.exports_root).toEqual(packageSpec.exports_root);
    expect(decoded.exports_count).toBe(packageSpec.exports_count);

    // Optional debug outputs
    writeFileSync(
      path.resolve(__dirname, "../output/encodedPackageSpec.hex"),
      toHex(encoded)
    );
    writeFileSync(
      path.resolve(__dirname, "../output/decodedPackageSpec.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );
  });
});
