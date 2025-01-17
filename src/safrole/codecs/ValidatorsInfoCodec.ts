import { toUint8Array } from "../../codecs";
import { ValidatorInfoCodec } from "../../codecs/ValidatorInfoCodec";
import { ValidatorInfo } from "../../stf/types";
import { Codec } from "scale-ts";

// We have a known size of 6 (validators-count = 6)
export const ValidatorsInfoCodec: Codec<ValidatorInfo[]> = [
    // ENCODER
    (vals: ValidatorInfo[]): Uint8Array => {
      if (vals.length !== 6) {
        throw new Error(`ValidatorInfoCodec: must have exactly 6 items`);
      }
      return concatAll(...vals.map((v) => ValidatorInfoCodec.enc(v)));
    },
  
    // DECODER
    (data: ArrayBuffer | Uint8Array | string): ValidatorInfo[] => {

      const uint8 = toUint8Array(data);
      // each item is 336 bytes => total = 6 * 336 = 2016
      if (uint8.length !== 2016) {
        throw new Error(`ValidatorInfoCodec: expected 2016 bytes, got ${uint8.length}`);
      }
      console.log("ValidatorsInfoCodec.dec: uint8.length =", uint8.length);

      const out: ValidatorInfo[] = [];
      let offset = 0;
      for (let i = 0; i < 6; i++) {
        const slice = uint8.slice(offset, offset + 336);
        offset += 336;
        out.push(ValidatorInfoCodec.dec(slice));
      }
      return out;
    },
  ] as unknown as Codec<ValidatorInfo[]>;
  
  ValidatorsInfoCodec.enc = ValidatorsInfoCodec[0];
  ValidatorsInfoCodec.dec = ValidatorsInfoCodec[1];

  
function concatAll(...arrays: Uint8Array[]): Uint8Array {
    const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}
  