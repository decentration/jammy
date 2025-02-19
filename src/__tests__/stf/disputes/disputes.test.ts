import fs from "fs";
import path from "path";
import { Disputes } from "../../../stf/disputes/types";
import { DisputesCodec } from "../../../stf/disputes/codecs/DisputesCodec";
import { deepConvertHexToBytes } from "../../../codecs/utils";
import { convertToReadableFormat } from "../../../utils";
// import { compareBytes } from "../../../utils";

describe("DisputesCodec roundtrip", () => {
  const testFiles = [
    "progress_invalidates_avail_assignments-1",
    "progress_with_bad_signatures-1",
    "progress_with_bad_signatures-2",
    "progress_with_culprits-1",
    "progress_with_culprits-2",
    "progress_with_culprits-3",
    "progress_with_culprits-4",
    "progress_with_culprits-5",
    "progress_with_culprits-6",
    "progress_with_culprits-7",
    "progress_with_faults-1",
    "progress_with_faults-2",
    "progress_with_faults-3",
    "progress_with_faults-4",
    "progress_with_faults-5",
    "progress_with_faults-6",
    "progress_with_faults-7",
    "progress_with_no_verdicts-1",
    "progress_with_verdict_signatures_from_previous_set-1",
    "progress_with_verdict_signatures_from_previous_set-2",
    "progress_with_verdicts-1",
    "progress_with_verdicts-2",
    "progress_with_verdicts-3",
    "progress_with_verdicts-4",
    "progress_with_verdicts-5",
    "progress_with_verdicts-6",
  ];

  testFiles.forEach((fileName) => {
    it(`encodes/decodes from ${fileName}`, () => {
      // 1) load JSON
      const filePath = path.join(__dirname, "../../../stf/disputes/data/full", fileName.concat('.json'));
      const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      // 2) convert all 0x  => Uint8Arrays
      const disputeObj = deepConvertHexToBytes(raw) as Disputes;

      // 3) encode
      const encoded = DisputesCodec.enc(disputeObj);
      // console.log("encoded: ", convertToReadableFormat(encoded));
      // 4) decode
      const decoded = DisputesCodec.dec(encoded);

      // 5) compare
      expect(convertToReadableFormat(decoded)).toStrictEqual(
        convertToReadableFormat(disputeObj));

      // compare encoded with .bin 

      const binPath = path.join(__dirname, "../../../stf/disputes/data/full", fileName.concat(".bin"));
      const binData = new Uint8Array(fs.readFileSync(binPath));

      // bin file
      const decode = DisputesCodec.dec(binData);

      // re-encode
      const reEncoded = DisputesCodec.enc(decode);

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
