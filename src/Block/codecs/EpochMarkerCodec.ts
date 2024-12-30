import { Codec } from "scale-ts";
import { Bytes } from "scale-ts";
import { EpochMarker } from "../types";

export const EpochMarkerCodec: Codec<EpochMarker> = [
  // ENCODER
  (mark: EpochMarker) => {
    const encEntropy = Bytes(32).enc(mark.entropy);
    const encTicketsEntropy = Bytes(32).enc(mark.tickets_entropy);
    const encValidators = new Uint8Array(mark.validators.length * 32);
    for (let i = 0; i < mark.validators.length; i++) {
      if (mark.validators[i].length !== 32) {
        throw new Error(`Validator #${i} is not 32 bytes`);
      }
      encValidators.set(mark.validators[i], i * 32);
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

    // read validators until we see 0x00 0x01
    const slice = uint8.slice(offset);
    const { validators, bytesUsed } = decodeValidatorsUntilTerminated(slice);
    offset += bytesUsed;

    return { entropy, tickets_entropy, validators };
  },
] as unknown as Codec<EpochMarker>;

EpochMarkerCodec.enc = EpochMarkerCodec[0];
EpochMarkerCodec.dec = EpochMarkerCodec[1];


function decodeValidatorsUntilTerminated(data: Uint8Array): {
    validators: Uint8Array[];
    bytesUsed: number;
  } {
    let offset = 0;
    const validators: Uint8Array[] = [];
  
    while (true) {
      if (offset + 33 > data.length) {
        break;
      }

      const nextByte = data.slice(offset + 32, offset + 33);
      if (nextByte[0] === 0x00) {
        break;
      }
  
      const validator = data.slice(offset, offset + 32);
      validators.push(validator);
      offset += 32;
    }
  
    return { validators, bytesUsed: offset };
  }
  