import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { toHex } from "../../utils"; 

import { WorkPackage, WorkItem, ImportSpec, ExtrinsicSpec } from "../../types/types";
import { WorkPackageCodec } from "../../codecs/WorkPackageCodec";

describe("WorkPackageCodec test", () => {
  it("encodes/decodes entire WorkPackage from JSON", () => {
    // 1) Load the JSON file
    const jsonPath = path.resolve(__dirname, "../../data/work_packages/work_package.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Convert the JSON object into typed WorkPackage.
    const wp: WorkPackage = {
      authorization: Uint8Array.from(Buffer.from(raw.authorization.slice(2), "hex")),
      auth_code_host: raw.auth_code_host,
      authorizer: {
        code_hash: Uint8Array.from(Buffer.from(raw.authorizer.code_hash.slice(2), "hex")),
        params: Uint8Array.from(Buffer.from(raw.authorizer.params.slice(2), "hex")),
      },
      context: {
        anchor: Uint8Array.from(Buffer.from(raw.context.anchor.slice(2), "hex")),
        state_root: Uint8Array.from(Buffer.from(raw.context.state_root.slice(2), "hex")),
        beefy_root: Uint8Array.from(Buffer.from(raw.context.beefy_root.slice(2), "hex")),
        lookup_anchor: Uint8Array.from(Buffer.from(raw.context.lookup_anchor.slice(2), "hex")),
        lookup_anchor_slot: raw.context.lookup_anchor_slot,
        prerequisites: raw.context.prerequisites.map((hexStr: string) =>
          Uint8Array.from(Buffer.from(hexStr.slice(2), "hex"))
        ),
      },
      items: raw.items.map((itemRaw: any) => {
        const item: WorkItem = {
          service: itemRaw.service,
          code_hash: Uint8Array.from(Buffer.from(itemRaw.code_hash.slice(2), "hex")),
          payload: Uint8Array.from(Buffer.from(itemRaw.payload.slice(2), "hex")),
          refine_gas_limit: itemRaw.refine_gas_limit,
          accumulate_gas_limit: itemRaw.accumulate_gas_limit,
          import_segments: itemRaw.import_segments.map((im: any) => {
            const ispec: ImportSpec = {
              tree_root: Uint8Array.from(Buffer.from(im.tree_root.slice(2), "hex")),
              index: im.index,
            };
            return ispec;
          }),
          extrinsic: itemRaw.extrinsic.map((ex: any) => {
            const espec: ExtrinsicSpec = {
              hash: Uint8Array.from(Buffer.from(ex.hash.slice(2), "hex")),
              len: ex.len,
            };
            return espec;
          }),
          export_count: itemRaw.export_count,
        };
        return item;
      }),
    };

    // 3) Encode the WorkPackage
    const encoded = WorkPackageCodec.enc(wp);
    console.log("Encoded WorkPackage hex:", toHex(encoded));

    // 4) Decode the bytes back
    const decoded = WorkPackageCodec.dec(encoded);

    // 5) Validate round-trip
    expect(decoded).toStrictEqual(wp);
  });

  it("decodes work_package.bin from conformance data", () => {
    // 1) Load the .bin
    const binPath = path.resolve(__dirname, "../../data/work_packages/work_package.bin");
    const rawBin = new Uint8Array(readFileSync(binPath));
    console.log("Raw work_package.bin hex:", toHex(rawBin));

    // 2) Decode
    const decodedFromBin = WorkPackageCodec.dec(rawBin);

    // (Optionally) print or save for inspection:
    // console.log("Decoded from .bin:", convertToReadableFormat(decodedFromBin));

    // 3) Compare it to the JSON file
    const jsonPath = path.resolve(__dirname, "../../data/work_packages/work_package.json");
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // We transform the JSON the same way as above:
    const wpFromJson: WorkPackage = {
      authorization: Uint8Array.from(Buffer.from(rawJson.authorization.slice(2), "hex")),
      auth_code_host: rawJson.auth_code_host,
      authorizer: {
        code_hash: Uint8Array.from(Buffer.from(rawJson.authorizer.code_hash.slice(2), "hex")),
        params: Uint8Array.from(Buffer.from(rawJson.authorizer.params.slice(2), "hex")),
      },
      context: {
        anchor: Uint8Array.from(Buffer.from(rawJson.context.anchor.slice(2), "hex")),
        state_root: Uint8Array.from(Buffer.from(rawJson.context.state_root.slice(2), "hex")),
        beefy_root: Uint8Array.from(Buffer.from(rawJson.context.beefy_root.slice(2), "hex")),
        lookup_anchor: Uint8Array.from(Buffer.from(rawJson.context.lookup_anchor.slice(2), "hex")),
        lookup_anchor_slot: rawJson.context.lookup_anchor_slot,
        prerequisites: rawJson.context.prerequisites.map((hexStr: string) =>
          Uint8Array.from(Buffer.from(hexStr.slice(2), "hex"))
        ),
      },
      items: rawJson.items.map((itemRaw: any) => ({
        service: itemRaw.service,
        code_hash: Uint8Array.from(Buffer.from(itemRaw.code_hash.slice(2), "hex")),
        payload: Uint8Array.from(Buffer.from(itemRaw.payload.slice(2), "hex")),
        refine_gas_limit: itemRaw.refine_gas_limit,
        accumulate_gas_limit: itemRaw.accumulate_gas_limit,
        import_segments: itemRaw.import_segments.map((im: any) => ({
          tree_root: Uint8Array.from(Buffer.from(im.tree_root.slice(2), "hex")),
          index: im.index,
        })),
        extrinsic: itemRaw.extrinsic.map((ex: any) => ({
          hash: Uint8Array.from(Buffer.from(ex.hash.slice(2), "hex")),
          len: ex.len,
        })),
        export_count: itemRaw.export_count,
      })),
    };

    // 4) Check they match
    expect(decodedFromBin).toStrictEqual(wpFromJson);

    // 5) Re-encode the decoded object and compare with original .bin
    const reEncoded = WorkPackageCodec.enc(decodedFromBin);
    expect(reEncoded).toEqual(rawBin);
  });
});
