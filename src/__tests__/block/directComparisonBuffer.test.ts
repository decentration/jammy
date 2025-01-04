import { readFileSync } from "fs";
import path from "path";
import { Block } from "../../types/types";
import { BlockCodec } from "../../block/BlockCodec";
import { toHex } from "../../utils";

describe("Block binary comparison test", () => {
  it("compares official block.bin with newly encoded bin from block.json", () => {
    // 1) Read bin
    const binPath = path.resolve(__dirname, "../../data/block.bin");
    const officialBin = readFileSync(binPath);

    // 2) Read block.json
    const jsonPath = path.resolve(__dirname, "../../data/block.json");
    const rawJson = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 3) mkae block
    const block: Block = {
      header: {
        parent: Uint8Array.from(Buffer.from(rawJson.header.parent.slice(2), "hex")),
        parent_state_root: Uint8Array.from(Buffer.from(rawJson.header.parent_state_root.slice(2), "hex")),
        extrinsic_hash: Uint8Array.from(Buffer.from(rawJson.header.extrinsic_hash.slice(2), "hex")),
        slot: rawJson.header.slot,
        epoch_mark: rawJson.header.epoch_mark
          ? {
              entropy: Uint8Array.from(Buffer.from(rawJson.header.epoch_mark.entropy.slice(2), "hex")),
              tickets_entropy: Uint8Array.from(Buffer.from(rawJson.header.epoch_mark.tickets_entropy.slice(2), "hex")),
              validators: rawJson.header.epoch_mark.validators.map((v: string) =>
                Uint8Array.from(Buffer.from(v.slice(2), "hex"))
              ),
            }
          : null,
        tickets_mark: rawJson.header.tickets_mark
          ? rawJson.header.tickets_mark.map((tm: any) => ({
              id: Uint8Array.from(Buffer.from(tm.id.slice(2), "hex")),
              attempt: tm.attempt,
            }))
          : null,
        offenders_mark: rawJson.header.offenders_mark.map((om: string) =>
          Uint8Array.from(Buffer.from(om.slice(2), "hex"))
        ),
        author_index: rawJson.header.author_index,
        entropy_source: Uint8Array.from(Buffer.from(rawJson.header.entropy_source.slice(2), "hex")),
        seal: rawJson.header.seal ? Uint8Array.from(Buffer.from(rawJson.header.seal.slice(2), "hex")) : null,
      },
      extrinsic: {
        tickets: rawJson.extrinsic.tickets.map((t: any) => ({
          attempt: t.attempt,
          signature: Uint8Array.from(Buffer.from(t.signature.slice(2), "hex")),
        })),
        preimages: rawJson.extrinsic.preimages.map((p: any) => ({
          requester: p.requester,
          blob: Uint8Array.from(Buffer.from(p.blob.slice(2), "hex")),
        })),
        guarantees: rawJson.extrinsic.guarantees.map((g: any) => ({
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
              accumulate_gas: r.accumulate_gas, // must be bigint or number per your usage
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
        assurances: rawJson.extrinsic.assurances.map((a: any) => ({
          anchor: Uint8Array.from(Buffer.from(a.anchor.slice(2), "hex")),
          bitfield: Uint8Array.from(Buffer.from(a.bitfield.slice(2), "hex")),
          validator_index: a.validator_index,
          signature: Uint8Array.from(Buffer.from(a.signature.slice(2), "hex")),
        })),
        disputes: {
          verdicts: rawJson.extrinsic.disputes.verdicts.map((vd: any) => ({
            target: Uint8Array.from(Buffer.from(vd.target.slice(2), "hex")),
            age: vd.age,
            votes: vd.votes.map((v: any) => ({
              vote: v.vote,
              index: v.index,
              signature: Uint8Array.from(Buffer.from(v.signature.slice(2), "hex")),
            })),
          })),
          culprits: rawJson.extrinsic.disputes.culprits.map((cp: any) => ({
            target: Uint8Array.from(Buffer.from(cp.target.slice(2), "hex")),
            key: Uint8Array.from(Buffer.from(cp.key.slice(2), "hex")),
            signature: Uint8Array.from(Buffer.from(cp.signature.slice(2), "hex")),
          })),
          faults: rawJson.extrinsic.disputes.faults.map((ft: any) => ({
            target: Uint8Array.from(Buffer.from(ft.target.slice(2), "hex")),
            vote: ft.vote,
            key: Uint8Array.from(Buffer.from(ft.key.slice(2), "hex")),
            signature: Uint8Array.from(Buffer.from(ft.signature.slice(2), "hex")),
          })),
        },
      },
    };

    // 4) Encode block 
    const encoded = BlockCodec.enc(block);

    const decoded = BlockCodec.dec(officialBin);

    expect (decoded).toStrictEqual(block);

    // 5) Compare 
    console.log("Official .bin length:", officialBin.length);
    console.log("Encoded from JSON length:", encoded.length);

    expect(officialBin.length).toBe(encoded.length);

    // 6) Compare each byte
    for (let i = 0; i < officialBin.length; i++) {
      if (officialBin[i] !== encoded[i]) {
        const message = [
          `Mismatch at byte offset ${i}`,
          `Official: 0x${officialBin[i].toString(16).padStart(2, "0")}`,
          `Ours: 0x${encoded[i].toString(16).padStart(2, "0")}`,
        ].join(" | ");
        throw new Error(message);
      }
    }

    // if no mismatch found, they are same
    console.log("No byte differences found. The block.bin matches the BlockCodec output exactly!");
  });
});
