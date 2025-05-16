import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { Block } from "../../types/types";
import { BlockCodec } from "../../block/BlockCodec";
import { convertToReadableFormat, toHex } from "../../utils";
import { deepConvertHexToBytes } from "../../codecs";
import { JAM_TEST_VECTORS } from "../../consts";

describe("BlockCodec test", () => {
  it("encodes/decodes entire block data from JSON", () => {
    // 1) Load     
    const jsonPath = path.resolve(__dirname, `../../../${JAM_TEST_VECTORS}`, "./codec/data/block.json");
    // const jsonPath = path.resolve(__dirname, "../output/block/encodedBlock.txt");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // 2) Construct typed `Block`
    const block = deepConvertHexToBytes(raw);
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
    const binPath = path.resolve(__dirname, `../../../${JAM_TEST_VECTORS}`, "./codec/data/block.bin");
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
