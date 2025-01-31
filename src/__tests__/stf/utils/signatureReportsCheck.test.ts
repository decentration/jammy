import fs from "fs";
import path from "path";
import nacl from "tweetnacl"; 
import { convertToReadableFormat, toHex } from "../../../utils";
import { hexStringToBytes, toUint8Array } from "../../../codecs/utils";
import { blake2b } from "blakejs";
import { ReportCodec } from "../../../codecs";
import { parseReportFromJson } from "./parseGuaranteeFromJson";

describe("Debug signature for reports", () => {
  it("checks the signature from first report item (with blake2b + label)", () => {
    // 1) read JSON
    const fileName = "core_engaged-1.json";
    const filePath = path.join(__dirname, "../../../stf/reports/data/tiny", fileName);
    const rawJson = fs.readFileSync(filePath, "utf8");
    const testVector = JSON.parse(rawJson);

    

    // 2) get the first assurance
    const [guarantee0] = testVector.input.guarantees;
    const reportObj = parseReportFromJson(guarantee0.report);
    console.log("reportObj", reportObj);


    const report0Encoded = ReportCodec.enc(reportObj);
    console.log("report0Encoded", report0Encoded);

    // 3) Convert hex => Uint8Array
    const preState = convertToReadableFormat(testVector.pre_state);
    const reportSig0 = guarantee0.signatures[0].signature;
    console.log("reportSig0", reportSig0);
    const reportCurrVal0Ed = preState.curr_validators[1].ed25519;
    const signature = new Uint8Array(hexStringToBytes(reportSig0));
    console.log("signature", signature);
    const publicKey = new Uint8Array(hexStringToBytes(reportCurrVal0Ed));
    const hashed = blake2b(report0Encoded, undefined, 32);

    const label = new TextEncoder().encode("jam_guarantee");
    const finalMsg = new Uint8Array(label.length + hashed.length);
    console.log("finalMsg", finalMsg, finalMsg.length);

    finalMsg.set(label, 0);
    finalMsg.set(hashed, label.length);

    // console.log("finalMsg signature, publicKey", {finalMsg, signature, publicKey});
    // console.log("finalMsg", toHex(finalMsg));
    // console.log("signature", toHex(signature));
    // console.log("publicKey", toHex(publicKey));

    const finalMsgHex = toHex(finalMsg);

    // verify with tweetnacl because noble is not working in this environment
    const isValid = nacl.sign.detached.verify(finalMsg, signature, publicKey);
    console.log("Is signature valid =>", isValid);

    expect(isValid).toBe(true);
  });
});
