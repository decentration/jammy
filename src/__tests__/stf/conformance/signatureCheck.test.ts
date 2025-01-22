import fs from "fs";
import path from "path";
import nacl from "tweetnacl"; 
import { convertToReadableFormat } from "../../../utils";
import { hexStringToBytes } from "../../../codecs/utils";
import { blake2b } from "blakejs";

describe("Debug signature for assurances", () => {
  it("checks the signature from first assurance item (with blake2b + label)", () => {
    // 1) read JSON
    const fileName = "assurance_for_not_engaged_core-1.json";
    const filePath = path.join(__dirname, "../../../stf/assurances/data", fileName);
    const rawJson = fs.readFileSync(filePath, "utf8");
    const testVector = JSON.parse(rawJson);

    // 2) get the first assurance
    const [assurance0] = testVector.input.assurances;
    const preState = convertToReadableFormat(testVector.pre_state);

    // 3) Convert hex => Uint8Array
    const anchor = new Uint8Array(hexStringToBytes(assurance0.anchor));       
    const bitfield = new Uint8Array(hexStringToBytes(assurance0.bitfield));   
    const signature = new Uint8Array(hexStringToBytes(assurance0.signature)); 
    const publicKey = new Uint8Array(hexStringToBytes(preState.curr_validators[ assurance0.validator_index ].ed25519));


    const bitfieldLength = bitfield.length;
    const encoded = new Uint8Array(anchor.length + bitfieldLength);

    encoded.set(anchor, 0);
    encoded.set(bitfield, anchor.length);

    const hashed = blake2b(encoded, undefined, 32);

    const label = new TextEncoder().encode("jam_available");

    // console.log("label", label);

    const finalMsg = new Uint8Array(label.length + hashed.length);
    finalMsg.set(label, 0);
    finalMsg.set(hashed, label.length);

    // console.log("finalMsg signature, publicKey", {finalMsg, signature, publicKey});
    // console.log("finalMsg", toHex(finalMsg));
    // console.log("signature", toHex(signature));
    // console.log("publicKey", toHex(publicKey));

    // verify with tweetnacl because noble is not working in this environment
    const isValid = nacl.sign.detached.verify(finalMsg, signature, publicKey);
    console.log("Is signature valid =>", isValid);

    expect(isValid).toBe(true);
  });
});
