import fs from "fs";
import path from "path";
import { SafroleStf } from "../../safrole/types";
import { SafroleStfCodec } from "../../safrole/codecs/SafroleStfCodec";
import { deepConvertHexToBytes } from "../../codecs/utils";
import { convertToReadableFormat } from "../../utils";
// import { compareBytes } from "../../../utils";

describe("SafroleStfCodec roundtrip", () => {
  const testFiles = [
    "enact-epoch-change-with-no-tickets-1",
    "enact-epoch-change-with-no-tickets-2",
    "enact-epoch-change-with-no-tickets-3",
    "enact-epoch-change-with-no-tickets-4",
    "enact-epoch-change-with-padding-1",
    "publish-tickets-no-mark-1",
    "publish-tickets-no-mark-2",
    "publish-tickets-no-mark-3",
    "publish-tickets-no-mark-4",
    "publish-tickets-no-mark-5",
    "publish-tickets-no-mark-6",
    "publish-tickets-no-mark-7",
    "publish-tickets-no-mark-8",
    "publish-tickets-no-mark-9",
    "publish-tickets-with-mark-1",
    "publish-tickets-with-mark-2",
    "publish-tickets-with-mark-3",
    "publish-tickets-with-mark-4",
    "publish-tickets-with-mark-5",
    "skip-epoch-tail-1",
    "skip-epochs-1"
  ];

  testFiles.forEach((fileName) => {
    it(`encodes/decodes from ${fileName}`, () => {
      // 1) load JSON
      const filePath = path.join(__dirname, "../../safrole/data/tiny", fileName.concat('.json'));
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      // 2) convert all 0x  => Uint8Arrays
      const safroleObj = deepConvertHexToBytes(raw) as SafroleStf;

      // 3) encode
      const encoded = SafroleStfCodec.enc(safroleObj);
      // console.log("encoded: ", convertToReadableFormat(encoded));
      // 4) decode
      const decoded = SafroleStfCodec.dec(encoded);

      // 5) compare
      expect(convertToReadableFormat(decoded)).toStrictEqual(
        convertToReadableFormat(safroleObj));

      // compare encoded with .bin 

      const binPath = path.join(__dirname, "../../safrole/data/tiny", fileName.concat(".bin"));
      const binData = new Uint8Array(fs.readFileSync(binPath));

      // bin file
      const decode = SafroleStfCodec.dec(binData);

      // re-encode
      const reEncoded = SafroleStfCodec.enc(decode);

      // const diffs = compareBytes(reEncoded, binData);
      // if (diffs === 0 && reEncoded.length === binData.length) {
      //   console.log("Perfect match!");
      // } else {
      //   console.log("Mismatch found, see logs above.", diffs);
      // }

      // compare
      expect(reEncoded).toEqual(binData);
      
    
    });
  });
});
