import { Codec } from "scale-ts";
import { Bytes } from "scale-ts";
import { EpochMarker } from "../types/types";

export const EpochMarkerCodec: Codec<EpochMarker> = [
  // ENCODER
  (mark: EpochMarker) => {
    console.log('EpochMarkerCodec: mark:', mark);
    const encEntropy = Bytes(32).enc(mark.entropy);
    const encTicketsEntropy = Bytes(32).enc(mark.tickets_entropy);
    const encValidators = new Uint8Array(mark.validators.length * 32);
    console.log('EpochMarkerCodec: validators before encoding:', mark.validators);

    for (let i = 0; i < mark.validators.length; i++) {
      const validator = mark.validators[i];
      console.log('EpochMarkerCodec: validator:', i, validator);
      if (!validator || validator.length !== 32) {
        // count how many bytes the validator is
        // console.log('EpochMarkerCodec: validator:', i, validator);
        throw new Error(`Validator #${i} is not 32 bytes: got ${validator ? validator.length : 'undefined'}`);

      }
      encValidators.set(validator, i * 32);
      console.log('EpochMarkerCodec: encValidators length:', i, validator.length, Buffer.from(encValidators).toString('hex'));
    }
 

    const out = new Uint8Array(encEntropy.length + encTicketsEntropy.length + encValidators.length);
    out.set(encEntropy, 0);                   // first 32
    out.set(encTicketsEntropy, 32);       // second 32
    out.set(encValidators, 64);             // remainder
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    if (offset + 32 > uint8.length) {
      throw new Error("EpochMarkerCodec: not enough data for `entropy`");
    }
    const entropy = uint8.slice(offset, offset + 32);
    offset += 32;


    if (offset + 32 > uint8.length) {
      throw new Error("EpochMarkerCodec: not enough data for `tickets_entropy`");
    }
    const tickets_entropy = uint8.slice(offset, offset + 32);
    offset += 32;

    // read validators until we see 0x00
    const slice = uint8.slice(offset);
    const { validators, bytesUsed } = decodeValidatorsUntilTerminated(slice);
    offset += bytesUsed;

    return { entropy, tickets_entropy, validators };
  },
] as unknown as Codec<EpochMarker>;

EpochMarkerCodec.enc = EpochMarkerCodec[0];
EpochMarkerCodec.dec = EpochMarkerCodec[1];


function decodeValidatorsUntilTerminated(
  data: Uint8Array
): { validators: Uint8Array[]; bytesUsed: number } {
  let offset = 0;
  const validators: Uint8Array[] = [];

  while (offset + 32 <= data.length) {
    const validator = data.slice(offset, offset + 32);

    offset += 32;

    validators.push(validator);

    if (offset < data.length) {
      if (data[offset] === 0x00) {
        console.log("Terminating validators at offset", offset, "since next byte = 0x00");
        break;
      }
    }
  }

  return { validators, bytesUsed: offset };
}
