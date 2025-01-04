import { Codec } from "scale-ts";
import { ValidatorInfo } from "../../types";
import { ValidatorInfoCodec } from "./ValidatorInfoCodec";
import { VALIDATOR_COUNT } from "../../../consts/tiny";

export const CurrValidatorsCodec: Codec<ValidatorInfo[]> = (() => {
  const encode = (vals: ValidatorInfo[]): Uint8Array => {
    if (vals.length !== VALIDATOR_COUNT) {
      throw new Error(
        `CurrValidatorsCodec: expected exactly ${VALIDATOR_COUNT} validators, got ${vals.length}`
      );
    }
    let out = new Uint8Array(0);
    for (const v of vals) {
      const encV = ValidatorInfoCodec.enc(v);
      // Concat
      const tmp = new Uint8Array(out.length + encV.length);
      tmp.set(out, 0);
      tmp.set(encV, out.length);
      out = tmp;
    }
    return out;
  };

  const decode = (data: ArrayBuffer | Uint8Array | string): ValidatorInfo[] => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    const vals: ValidatorInfo[] = [];
    let offset = 0;
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      // Decode next validator
      const slice = uint8.slice(offset);
      const decodedVal = ValidatorInfoCodec.dec(slice);

      // Re-encode to measure how many bytes it used (336)
      const reEnc = ValidatorInfoCodec.enc(decodedVal);
      offset += reEnc.length;

      vals.push(decodedVal);
    }

    if (offset < uint8.length) {
      throw new Error(`CurrValidatorsCodec: leftover bytes after reading ${VALIDATOR_COUNT} validators`);
    }

    return vals;
  };

  const codec = [encode, decode] as Codec<ValidatorInfo[]>;
  codec.enc = encode;
  codec.dec = decode;
  return codec;
})();
