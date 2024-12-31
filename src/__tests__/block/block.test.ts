import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { Block } from "../../block/types";
import { BlockCodec } from "../../block/BlockCodec";
import { convertToReadableFormat, toHex } from "../../utils";

describe("BlockCodec test", () => {
  it("encodes/decodes entire block data from JSON", () => {
    // 1) Load 
    const jsonPath = path.resolve(__dirname, "../../data/block.json");
    // const jsonPath = path.resolve(__dirname, "../output/block/encodedBlock.txt");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Construct typed `Block`
    const block: Block = {
      header: {
        parent: Uint8Array.from(Buffer.from(raw.header.parent.slice(2), "hex")),
        parent_state_root: Uint8Array.from(Buffer.from(raw.header.parent_state_root.slice(2), "hex")),
        extrinsic_hash: Uint8Array.from(Buffer.from(raw.header.extrinsic_hash.slice(2), "hex")),
        slot: raw.header.slot,
        epoch_mark: raw.header.epoch_mark
          ? {
              entropy: Uint8Array.from(Buffer.from(raw.header.epoch_mark.entropy.slice(2), "hex")),
              tickets_entropy: Uint8Array.from(Buffer.from(raw.header.epoch_mark.tickets_entropy.slice(2), "hex")),
              validators: raw.header.epoch_mark.validators.map((v: string) =>
                Uint8Array.from(Buffer.from(v.slice(2), "hex"))
              ),
            }
          : null,
        tickets_mark: raw.header.tickets_mark
          ? raw.header.tickets_mark.map((tm: any) => ({
              id: Uint8Array.from(Buffer.from(tm.id.slice(2), "hex")),
              attempt: tm.attempt,
            }))
          : null,
        offenders_mark: raw.header.offenders_mark.map((om: string) =>
          Uint8Array.from(Buffer.from(om.slice(2), "hex"))
        ),
        author_index: raw.header.author_index,
        entropy_source: Uint8Array.from(Buffer.from(raw.header.entropy_source.slice(2), "hex")),
        seal: raw.header.seal ? Uint8Array.from(Buffer.from(raw.header.seal.slice(2), "hex")) : null,
      },
      extrinsic: {
        tickets: raw.extrinsic.tickets.map((t: any) => ({
          attempt: t.attempt,
          signature: Uint8Array.from(Buffer.from(t.signature.slice(2), "hex")),
        })),
        preimages: raw.extrinsic.preimages.map((p: any) => ({
          requester: p.requester,
          blob: Uint8Array.from(Buffer.from(p.blob.slice(2), "hex")),
        })),
        guarantees: raw.extrinsic.guarantees.map((g: any) => ({
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
              prerequisites: g.report.context.prerequisites.map((r: string) =>
                Uint8Array.from(Buffer.from(r.slice(2), "hex"))
              ),
            },
            core_index: g.report.core_index,
            authorizer_hash: Uint8Array.from(Buffer.from(g.report.authorizer_hash.slice(2), "hex")),
            auth_output: Uint8Array.from(Buffer.from(g.report.auth_output.slice(2), "hex")),
            segment_root_lookup: g.report.segment_root_lookup.map((s: string) =>
              Uint8Array.from(Buffer.from(s.slice(2), "hex"))
            ),
            results: g.report.results.map((r: any) => ({
              service_id: r.service_id,
              code_hash: Uint8Array.from(Buffer.from(r.code_hash.slice(2), "hex")),
              payload_hash: Uint8Array.from(Buffer.from(r.payload_hash.slice(2), "hex")),
              accumulate_gas: r.accumulate_gas,
              result: r.result.ok
                ? { ok: Uint8Array.from(Buffer.from(r.result.ok.slice(2), "hex")) }
                : { panic: null },
            })),
          },
          slot: g.slot,
          signatures: g.signatures.map((s: any) => ({
            validator_index: s.validator_index,
            signature: Uint8Array.from(Buffer.from(s.signature.slice(2), "hex")),
          })),
        })),
        assurances: raw.extrinsic.assurances.map((a: any) => ({
          anchor: Uint8Array.from(Buffer.from(a.anchor.slice(2), "hex")),
          bitfield: Uint8Array.from(Buffer.from(a.bitfield.slice(2), "hex")),
          validator_index: a.validator_index,
          signature: Uint8Array.from(Buffer.from(a.signature.slice(2), "hex")),
        })),
        disputes: {
          verdicts: raw.extrinsic.disputes.verdicts.map((vd: any) => ({
            target: Uint8Array.from(Buffer.from(vd.target.slice(2), "hex")),
            age: vd.age,
            votes: vd.votes.map((v: any) => ({
              vote: v.vote,
              index: v.index,
              signature: Uint8Array.from(Buffer.from(v.signature.slice(2), "hex")),
            })),
          })),
          culprits: raw.extrinsic.disputes.culprits.map((cp: any) => ({
            target: Uint8Array.from(Buffer.from(cp.target.slice(2), "hex")),
            key: Uint8Array.from(Buffer.from(cp.key.slice(2), "hex")),
            signature: Uint8Array.from(Buffer.from(cp.signature.slice(2), "hex")),
          })),
          faults: raw.extrinsic.disputes.faults.map((ft: any) => ({
            target: Uint8Array.from(Buffer.from(ft.target.slice(2), "hex")),
            vote: ft.vote,
            key: Uint8Array.from(Buffer.from(ft.key.slice(2), "hex")),
            signature: Uint8Array.from(Buffer.from(ft.signature.slice(2), "hex")),
          })),
        },
      },
    };

    // 3) Encode the block
    const encoded = BlockCodec.enc(block);
    console.log("Encoded Block:", toHex(encoded));

    // 4) Decode the block
    const decoded = BlockCodec.dec(encoded);

    // 5) write as a binary to file
    writeFileSync(
      path.resolve(__dirname, "../output/block/encodedBlock.bin"),
      toHex(encoded)
    );
    writeFileSync(
      path.resolve(__dirname, "../output/block/decodedBlock.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );
    writeFileSync(
      path.resolve(__dirname, "../output/block/originalBlock.json"),
      JSON.stringify(convertToReadableFormat(block), null, 2)
    );

    console.log('block hex', toHex(encoded) );

    // 6) Validate round-trip
    expect(decoded).toStrictEqual(block);
  });

  it("decodes block.bin from conformance data", () => {

    console.log('block.bin test');
    const binPath = path.resolve(__dirname, "../../data/block.bin");
    const rawBin = new Uint8Array(readFileSync(binPath));
    // const rawBin = readFileSync(binPath);
    // const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));
    console.log("Raw block.bin hex:", Buffer.from(rawBin).toString("hex"));

    const decoded = BlockCodec.dec(rawBin);
    console.log("Decoded Block:", convertToReadableFormat(decoded));

    writeFileSync(
      path.resolve(__dirname, "../output/block/bin_decoded.json"),
      JSON.stringify(convertToReadableFormat(decoded), null, 2)
    );

    const reEncoded = BlockCodec.enc(decoded);
    expect(reEncoded).toEqual(rawBin);
  });


});
