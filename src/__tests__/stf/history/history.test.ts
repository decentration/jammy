import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { History } from "../../../stf/types";    
import { HistoryCodec } from "../../../stf/history/codecs"; 
import { toHex, convertToReadableFormat } from "../../../utils";

describe("HistoryCodec test", () => {
  it("encodes/decodes entire history data from JSON", () => {
    // 1) read
    const jsonPath = path.resolve(__dirname, "../../../stf/history/data/progress_blocks_history-1.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) object
    const history: History = {
      input: {
        header_hash: Uint8Array.from(Buffer.from(raw.input.header_hash.slice(2), "hex")),
        parent_state_root: Uint8Array.from(Buffer.from(raw.input.parent_state_root.slice(2), "hex")),
        accumulate_root: Uint8Array.from(Buffer.from(raw.input.accumulate_root.slice(2), "hex")),
        work_packages: raw.input.work_packages.map((wp: any) => ({
          hash: Uint8Array.from(Buffer.from(wp.hash.slice(2), "hex")),
          exports_root: Uint8Array.from(Buffer.from(wp.exports_root.slice(2), "hex")),
        })),
      },
      pre_state: {
        beta: raw.pre_state.beta.map((b: any) => ({
          header_hash: Uint8Array.from(Buffer.from(b.header_hash.slice(2), "hex")),
          mmr: {
            peaks: b.mmr.peaks.map((p: string | null) =>
              p === null
                ? null
                : Uint8Array.from(Buffer.from(p.slice(2), "hex"))
            ),
          },
          state_root: Uint8Array.from(Buffer.from(b.state_root.slice(2), "hex")),
          reported: b.reported.map((rep: any) => ({
            hash: Uint8Array.from(Buffer.from(rep.hash.slice(2), "hex")),
            exports_root: Uint8Array.from(Buffer.from(rep.exports_root.slice(2), "hex")),
          })),
        })),
      },
      output: null, 
      post_state: {
        beta: raw.post_state.beta.map((b: any) => ({
          header_hash: Uint8Array.from(Buffer.from(b.header_hash.slice(2), "hex")),
          mmr: {
            peaks: b.mmr.peaks.map((p: string | null) =>
              p === null
                ? null
                : Uint8Array.from(Buffer.from(p.slice(2), "hex"))
            ),
          },
          state_root: Uint8Array.from(Buffer.from(b.state_root.slice(2), "hex")),
          reported: b.reported.map((rep: any) => ({
            hash: Uint8Array.from(Buffer.from(rep.hash.slice(2), "hex")),
            exports_root: Uint8Array.from(Buffer.from(rep.exports_root.slice(2), "hex")),
          })),
        })),
      },
    };

    // 3) encode
    const encoded = HistoryCodec.enc(history);
    console.log("History encoded bytes:", toHex(encoded));

    // 4) Decode
    const decoded = HistoryCodec.dec(encoded);

    // 5) Convert to readable hex forms or JSON so you can inspect them
    const readableEncoded = toHex(encoded);
    const readableDecoded = convertToReadableFormat(decoded);
    const readableOriginal = convertToReadableFormat(history);

    // 6) write out
    writeFileSync(
      path.resolve(__dirname, "../../output/stf/history/encodedHistory.txt"),
      readableEncoded
    );
    writeFileSync(
      path.resolve(__dirname, "../../output/stf/history/decodedHistory.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
    writeFileSync(
      path.resolve(__dirname, "../../output/stf/history/originalHistory.json"),
      JSON.stringify(readableOriginal, null, 2)
    );

    // 7) expect
    expect(decoded).toStrictEqual(history);
  });

  it("decodes history.bin from conformance data and verifies round-trip encoding", () => {
    const binPath = path.resolve(__dirname, "../../../stf/history/data/progress_blocks_history-1.bin");
    const binary = new Uint8Array(readFileSync(binPath));
    console.log("Conformance binary (hex):", toHex(binary));
  
    const decoded = HistoryCodec.dec(binary);
  
    const readableDecoded = convertToReadableFormat(decoded);
    console.log("Decoded Conformance History:", JSON.stringify(readableDecoded, null, 2));
  
    writeFileSync(
      path.resolve(__dirname, "../../output/stf/history/decodedConformanceHistory.json"),
      JSON.stringify(readableDecoded, null, 2)
    );
  
    const reEncoded = HistoryCodec.enc(decoded);
    console.log("Re-encoded binary (hex):", toHex(reEncoded));
  
    writeFileSync(
      path.resolve(__dirname, "../../output/stf/history/reEncodedHistory.bin"),
      reEncoded
    );
  
    expect(reEncoded).toEqual(binary);
  
 
  });
  
});
