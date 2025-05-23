import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { Header } from "../../types/types";
import { deepConvertHexToBytes, HeaderCodec } from "../../codecs";
import { toHex, convertToReadableFormat } from "../../utils";
import { JAM_TEST_VECTORS } from "../../consts";

describe("HeaderCodec test", () => {
  it("encodes/decodes entire header data from JSON", () => {
    const jsonPath = path.resolve(__dirname, `../../../${JAM_TEST_VECTORS}`, "./codec/data/header_0.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // const header: Header = {
    //   parent: Uint8Array.from(Buffer.from(raw.parent.slice(2), "hex")),
    //   parent_state_root: Uint8Array.from(Buffer.from(raw.parent_state_root.slice(2), "hex")),
    //   extrinsic_hash: Uint8Array.from(Buffer.from(raw.extrinsic_hash.slice(2), "hex")),
    //   slot: raw.slot,
    //   epoch_mark: raw.epoch_mark
    //     ? {
    //         entropy: Uint8Array.from(Buffer.from(raw.epoch_mark.entropy.slice(2), "hex")),
    //         tickets_entropy: Uint8Array.from(Buffer.from(raw.epoch_mark.tickets_entropy.slice(2), "hex")),
    //         validators: raw.epoch_mark.validators.map((v: any) =>
    //           Uint8Array.from(Buffer.from(v.slice(2), "hex"))
    //         ),
    //       }
    //     : null,
    //     tickets_mark: raw.tickets_mark
    //     ? raw.tickets_mark.map((tm: any) => ({
    //         id: Uint8Array.from(Buffer.from(tm.id.slice(2), "hex")),
    //         attempt: tm.attempt
    //       }))
    //     : null,
    //   offenders_mark: raw.offenders_mark.map((om: any) =>
    //     Uint8Array.from(Buffer.from(om.slice(2), "hex"))
    //   ),
    //   author_index: raw.author_index,
    //   entropy_source: Uint8Array.from(Buffer.from(raw.entropy_source.slice(2), "hex")),
    //   seal: raw.seal ? Uint8Array.from(Buffer.from(raw.seal.slice(2), "hex")) : null,
    // };

    const header = deepConvertHexToBytes(raw) as Header;
    const encoded = HeaderCodec.enc(header);
    console.log("Header encoded 1:", convertToReadableFormat(encoded));

    const decoded = HeaderCodec.dec(encoded);
    console.log("Header decoded 1:", convertToReadableFormat(decoded));

    // const readableEncoded = toHex(encoded);
    // const readableDecoded = convertToReadableFormat(decoded);
    // const readableOriginal = convertToReadableFormat(header);

    // writeFileSync(
    //   path.resolve(__dirname, "../../__tests__/output/headers/encodedHeader.txt"),
    //   readableEncoded
    // );
    // writeFileSync(
    //   path.resolve(__dirname, "../../__tests__/output/headers/decodedHeader.json"),
    //   JSON.stringify(readableDecoded, null, 2)
    // );
    // writeFileSync(
    //   path.resolve(__dirname, "../../__tests__/output/headers/originalHeader.json"),
    //   JSON.stringify(readableOriginal, null, 2)
    // );

    expect(decoded).toStrictEqual(header);
  });
});

  it("decodes header.bin from conformance data", () => {
    const binPath = path.resolve(__dirname, `../../../${JAM_TEST_VECTORS}`, "./codec/data/header_0.bin");
    const binary = new Uint8Array(readFileSync(binPath));

    console.log('header 2 binary decoded in bin comparison:', toHex(binary));
    const decoded = HeaderCodec.dec(binary);

    const readableDecoded = convertToReadableFormat(decoded);
    console.log("Decoded Conformance Header:", JSON.stringify(readableDecoded, null, 2));

  //   writeFileSync(
  //     path.resolve(__dirname, "../../__tests__/output/headers/decodedConformanceHeader.json"),
  //     JSON.stringify(readableDecoded, null, 2)
  //   );

    expect(decoded).toBeDefined(); 
 });