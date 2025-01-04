import { Context, ContextCodec } from "../../types/types";
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

describe("ContextCodec test", () => {
  it("encodes/decodes a Context from JSON", () => {
    // 1) Load JSON (or inline data)
    const jsonPath = path.resolve(__dirname, "../../data/guarantees/context.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert to typed Context
    const context: Context = {
      anchor: Uint8Array.from(Buffer.from(raw.anchor.slice(2), "hex")),
      state_root: Uint8Array.from(Buffer.from(raw.state_root.slice(2), "hex")),
      beefy_root: Uint8Array.from(Buffer.from(raw.beefy_root.slice(2), "hex")),
      lookup_anchor: Uint8Array.from(Buffer.from(raw.lookup_anchor.slice(2), "hex")),
      lookup_anchor_slot: raw.lookup_anchor_slot,
      prerequisites: raw.prerequisites.map((p: string) =>
        Uint8Array.from(Buffer.from(p.slice(2), "hex"))
      ),
    };

    // 3) Encode
    const encoded = ContextCodec.enc(context);

    // 4) Decode
    const decoded = ContextCodec.dec(encoded);

    // 5) Compare
    expect(decoded.anchor).toEqual(context.anchor);
    expect(decoded.state_root).toEqual(context.state_root);
    expect(decoded.beefy_root).toEqual(context.beefy_root);
    expect(decoded.lookup_anchor).toEqual(context.lookup_anchor);
    expect(decoded.lookup_anchor_slot).toBe(context.lookup_anchor_slot);
    expect(decoded.prerequisites).toEqual(context.prerequisites);

    // Optional debug outputs
    writeFileSync(
      path.resolve(__dirname, "../output/encodedContext.hex"),
      toHex(encoded)
    );
    writeFileSync(
      path.resolve(__dirname, "../output/decodedContext.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );
  });
});
