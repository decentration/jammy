import { readFileSync, writeFileSync } from "fs";
import path from "path";

import { ExtrinsicData } from "../../types/types";
import { ExtrinsicDataCodec } from "../../block/ExtrinsicData/ExtrinsicDataCodec";
import { convertToReadableFormat, toHex } from "../../utils";
import { JAM_TEST_VECTORS } from "../../consts";
import { deepConvertHexToBytes } from "../../codecs";

describe("ExtrinsicDataCodec test", () => {
  it("encodes/decodes entire extrinsic data from JSON", () => {
    // 1) Load raw JSON
    const jsonPath = path.resolve(__dirname, `../../../${JAM_TEST_VECTORS}`, "./codec/data/extrinsic.json");
    const raw = JSON.parse(readFileSync(jsonPath, "utf-8"));

    // lets log in both json and hex string format
//     console.log('extrinsicData:', JSON.stringify(extrinsicData, null, 2));
// console.log('extrinsicData:', convertToReadableFormat(extrinsicData));
    // 3) Encode extrinsic data

    const extrinsicDataHex = deepConvertHexToBytes(raw);
    console.log('extrinsicDataHex:', extrinsicDataHex);
    const encoded = ExtrinsicDataCodec.enc(extrinsicDataHex);
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
      JSON.stringify(convertToReadableFormat(extrinsicDataHex), null, 2)
    );

    // 6) Test equality
    expect(decoded).toStrictEqual(extrinsicDataHex);
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
