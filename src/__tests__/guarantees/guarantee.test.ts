import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Guarantee } from "../../block/types";  
import { GuaranteeCodec } from "../../block/codecs";

function toHex(uint8: Uint8Array): string {
  return "0x" + Buffer.from(uint8).toString("hex");
}

// Recursively convert all Uint8Arrays -> hex
function convertToReadableFormat(obj: any): any {
  if (obj instanceof Uint8Array) {
    return toHex(obj);
  } else if (Array.isArray(obj)) {
    return obj.map(convertToReadableFormat);
  } else if (typeof obj === 'object' && obj !== null) {
    const result: any = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = convertToReadableFormat(v);
    }
    return result;
  }
  return obj;
}

describe("GuaranteeCodec test", () => {
  it("encodes/decodes an entire guarantee from JSON", () => {
    // Load the JSON (ensure the path is correct and the JSON is an array)
    const jsonPath = path.resolve(__dirname, "../../data/guarantees/guarantees_extrinsic.json");
    const rawArray = JSON.parse(readFileSync(jsonPath, "utf-8"));
    
    // Ensure that rawArray is an array with at least one element
    expect(Array.isArray(rawArray)).toBe(true);
    expect(rawArray.length).toBeGreaterThan(0);

    const raw = rawArray[0]; // Access the first (and only) Guarantee object

    // Construct the Guarantee object
    const guarantee: Guarantee = {
      report: {
        package_spec: {
          hash: Uint8Array.from(Buffer.from(raw.report.package_spec.hash.slice(2), "hex")),
          length: raw.report.package_spec.length,
          erasure_root: Uint8Array.from(Buffer.from(raw.report.package_spec.erasure_root.slice(2), "hex")),
          exports_root: Uint8Array.from(Buffer.from(raw.report.package_spec.exports_root.slice(2), "hex")),
          exports_count: raw.report.package_spec.exports_count,
        },
        context: {
          anchor: Uint8Array.from(Buffer.from(raw.report.context.anchor.slice(2), "hex")),
          state_root: Uint8Array.from(Buffer.from(raw.report.context.state_root.slice(2), "hex")),
          beefy_root: Uint8Array.from(Buffer.from(raw.report.context.beefy_root.slice(2), "hex")),
          lookup_anchor: Uint8Array.from(Buffer.from(raw.report.context.lookup_anchor.slice(2), "hex")),
          lookup_anchor_slot: raw.report.context.lookup_anchor_slot,
          prerequisites: raw.report.context.prerequisites.map((p: any) => 
            Uint8Array.from(Buffer.from(p.slice(2), "hex"))
          ),
        },
        core_index: raw.report.core_index,
        authorizer_hash: Uint8Array.from(Buffer.from(raw.report.authorizer_hash.slice(2), "hex")),
        auth_output: Uint8Array.from(Buffer.from(raw.report.auth_output.slice(2), "hex")),
        segment_root_lookup: raw.report.segment_root_lookup.map((s: any) => 
          Uint8Array.from(Buffer.from(s.slice(2), "hex"))
        ),
        results: raw.report.results.map((r: any) => ({
          service_id: r.service_id,
          code_hash: Uint8Array.from(Buffer.from(r.code_hash.slice(2), "hex")),
          payload_hash: Uint8Array.from(Buffer.from(r.payload_hash.slice(2), "hex")),
          accumulate_gas: r.accumulate_gas,     
          result: (() => {
            if (r.result.ok) {
              return { ok: Uint8Array.from(Buffer.from(r.result.ok.slice(2), "hex")) };
            } else if (r.result.panic != null) {
              return { panic: null };
            } else {
              return { placeholder: null };
            }
          })(),
        })),
      },
      slot: raw.slot,
      signatures: raw.signatures.map((s: any) => ({
        validator_index: s.validator_index,
        signature: Uint8Array.from(Buffer.from(s.signature.slice(2), "hex")),
      })),
    }


    // 1) Encode the Guarantee
    const encoded = GuaranteeCodec.enc(guarantee);
    // 2) Decode the Guarantee
    const decoded = GuaranteeCodec.dec(encoded);

    // 3) Convert to human-readable format for debugging
    const readableEncoded = toHex(encoded);

    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(guarantee);

    // console.log("Decoded:", JSON.stringify(hexify(decoded), null, 2));
    // console.log("Original:", JSON.stringify(hexify(guarantee), null, 2));

    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/guarantees/encodedGuarantee.txt"),
      readableEncoded
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/guarantees/decodedGuarantee.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/guarantees/originalGuarantee.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // 4) Validate round-trip encoding/decoding
    expect(decoded).toStrictEqual(guarantee);
  });
});


function hexify(obj: any): any {
  if (obj instanceof Uint8Array) {
    return "0x" + Buffer.from(obj).toString("hex");
  }
  if (Array.isArray(obj)) {
    return obj.map(hexify);
  }
  if (obj && typeof obj === "object") {
    const out: any = {};
    for (const k of Object.keys(obj)) {
      out[k] = hexify(obj[k]);
    }
    return out;
  }
  return obj;
}
