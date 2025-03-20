import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { ExtrinsicData } from "../../types/types";
import { ExtrinsicDataCodec } from "../../block/ExtrinsicData/ExtrinsicDataCodec";
import { convertToReadableFormat, toHex } from "../../utils";

describe("ExtrinsicDataCodec test", () => {
  it("encodes/decodes entire extrinsic data from JSON", () => {
    // 1) Load raw JSON
    const jsonPath = path.resolve(__dirname, "../../data/extrinsic_data/extrinsic.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Construct typed `ExtrinsicData`
    const extrinsicData: ExtrinsicData = {
      tickets: raw.tickets.map((t: any) => ({
        attempt: t.attempt,
        signature: Uint8Array.from(Buffer.from(t.signature.slice(2), "hex")),
      })),
      preimages: raw.preimages.map((p: any) => ({
        requester: p.requester,
        blob: Uint8Array.from(Buffer.from(p.blob.slice(2), "hex")),
      })),
      guarantees: raw.guarantees.map((g: any) => ({
        report: {
          package_spec: {
            hash: Uint8Array.from(Buffer.from(g.report.package_spec.hash.slice(2), "hex")),
            length: g.report.package_spec.length,
            erasure_root: Uint8Array.from(Buffer.from(g.report.package_spec.erasure_root.slice(2), "hex")),
            exports_root: Uint8Array.from(Buffer.from(g.report.package_spec.exports_root.slice(2), "hex")),
            exports_count: g.report.package_spec.exports_count,
          },
          context: {
            anchor: Uint8Array.from(Buffer.from(g.report.context.anchor.slice(2), "hex")),
            state_root: Uint8Array.from(Buffer.from(g.report.context.state_root.slice(2), "hex")),
            beefy_root: Uint8Array.from(Buffer.from(g.report.context.beefy_root.slice(2), "hex")),
            lookup_anchor: Uint8Array.from(Buffer.from(g.report.context.lookup_anchor.slice(2), "hex")),
            lookup_anchor_slot: g.report.context.lookup_anchor_slot,
            prerequisites: g.report.context.prerequisites.map((r: any) =>
              Uint8Array.from(Buffer.from(r.slice(2), "hex"))
            ),
          },
          core_index: g.report.core_index,
          authorizer_hash: Uint8Array.from(Buffer.from(g.report.authorizer_hash.slice(2), "hex")),
          auth_output: Uint8Array.from(Buffer.from(g.report.auth_output.slice(2), "hex")),
          segment_root_lookup: g.report.segment_root_lookup.map((s: any) =>
            Uint8Array.from(Buffer.from(s.slice(2), "hex"))
          ),
          results: g.report.results.map((r: any) => ({
            service_id: r.service_id,
            code_hash: Uint8Array.from(Buffer.from(r.code_hash.slice(2), "hex")),
            payload_hash: Uint8Array.from(Buffer.from(r.payload_hash.slice(2), "hex")),
            accumulate_gas: r.accumulate_gas,
            result: ((): any => {
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
        slot: g.slot,
        signatures: g.signatures.map((s: any) => ({
          validator_index: s.validator_index,
          signature: Uint8Array.from(Buffer.from(s.signature.slice(2), "hex")),
        })),
      })),

        assurances: raw.assurances.map((a: any) => ({
            anchor: Uint8Array.from(Buffer.from(a.anchor.slice(2), "hex")),
            bitfield: Uint8Array.from(Buffer.from(a.bitfield.slice(2), "hex")),
            validator_index: a.validator_index,
            signature: Uint8Array.from(Buffer.from(a.signature.slice(2), "hex")),
        })),

      disputes: {
        verdicts: raw.disputes.verdicts.map((vd: any) => ({
          target: Uint8Array.from(Buffer.from(vd.target.slice(2), "hex")),
          age: vd.age,
          votes: vd.votes.map((v: any) => ({
            vote: v.vote,
            index: v.index,
            signature: Uint8Array.from(Buffer.from(v.signature.slice(2), "hex")),
          })),
        })),
        culprits: raw.disputes.culprits.map((cp: any) => ({
          target: Uint8Array.from(Buffer.from(cp.target.slice(2), "hex")),
          key: Uint8Array.from(Buffer.from(cp.key.slice(2), "hex")),
          signature: Uint8Array.from(Buffer.from(cp.signature.slice(2), "hex")),
        })),
        faults: raw.disputes.faults.map((ft: any) => ({
          target: Uint8Array.from(Buffer.from(ft.target.slice(2), "hex")),
          vote: ft.vote,
          key: Uint8Array.from(Buffer.from(ft.key.slice(2), "hex")),
          signature: Uint8Array.from(Buffer.from(ft.signature.slice(2), "hex")),
        })),
      },
    };
    // lets log in both json and hex string format
//     console.log('extrinsicData:', JSON.stringify(extrinsicData, null, 2));
// console.log('extrinsicData:', convertToReadableFormat(extrinsicData));
    // 3) Encode extrinsic data
    const encoded = ExtrinsicDataCodec.enc(extrinsicData);
    console.log('encoded:', toHex(encoded));

    // // 4) Decode
    const decoded = ExtrinsicDataCodec.dec(encoded);
// console.log('decoded:', JSON.stringify(decoded, null, 2));
    // 5) Debug logs
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/extrinsic/extrinsic_encoded.txt"),
      toHex(encoded)
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/extrinsic/extrinsic_decoded.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );
    writeFileSync(
      path.resolve(__dirname, "../../__tests__/output/extrinsic/extrinsic_original.json"),
      JSON.stringify(convertToReadableFormat(extrinsicData), null, 2)
    );

    // 6) Test equality
    expect(decoded).toStrictEqual(extrinsicData);
  });
});


// describe("ExtrinsicData conformance test", () => {
//   it("decodes extrinsic.bin from conformance data", () => {
//     // 1) Load the .bin file
//     const binPath = path.resolve(__dirname, "../../data/extrinsic_data/extrinsic.bin");
//     const rawBin = readFileSync(binPath);

//     // 2) Decode 
//     const decoded: ExtrinsicData = ExtrinsicDataCodec.dec(rawBin);

//     // 3) debugging
//     writeFileSync(
//       path.resolve(__dirname, "../../__tests__/output/extrinsic_bin_decoded.json"),
//       JSON.stringify(convertToReadableFormat(decoded), null, 2)
//     );
//     console.log("Decoded extrinsic data:", decoded);

//     // 4) Re‑encode 
//     const reEncoded = ExtrinsicDataCodec.enc(decoded);

//     // 5) Compare re‑encoded bytes to the original .bin
   
//     expect(reEncoded).toEqual(rawBin);

   
//   });
// });
