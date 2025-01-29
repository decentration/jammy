import { toUint8Array } from ".";
import { ValidatorInfoCodec } from "./ValidatorInfoCodec";
import { ValidatorInfo } from "../stf/types";
import { Codec } from "scale-ts";
import { VALIDATOR_COUNT } from "../consts";

const SINGLE_VALIDATOR_SIZE = 336;
const TOTAL_SIZE = VALIDATOR_COUNT * SINGLE_VALIDATOR_SIZE; // 2016

export const ValidatorsInfoCodec: Codec<ValidatorInfo[]> = [
  // ENCODER
  (validators: ValidatorInfo[]): Uint8Array => {
    if (validators.length !== VALIDATOR_COUNT) {
      throw new Error(
        `ValidatorsInfoCodec: expected ${VALIDATOR_COUNT} items, got ${validators.length}`
      );
    }

    // Encode each validator => 336 bytes
    const out = new Uint8Array(TOTAL_SIZE);
    let offset = 0;
    for (const val of validators) {
      const enc = encodeOneValidator(val);
      if (enc.length !== SINGLE_VALIDATOR_SIZE) {
        throw new Error(
          `encodeOneValidator returned ${enc.length} bytes, expected 336.`
        );
      }
      out.set(enc, offset);
      offset += SINGLE_VALIDATOR_SIZE;
    }
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): ValidatorInfo[] => {
    const uint8 = toUint8Array(data);

    // If fewer than 2016 => error
    if (uint8.length < TOTAL_SIZE) {
      throw new Error(
        `ValidatorsInfoCodec: not enough data (need ${TOTAL_SIZE}, got ${uint8.length}).`
      );
    }
    // We'll parse EXACTLY the first 2016 bytes
    const slice = uint8.subarray(0, TOTAL_SIZE);

    const validators: ValidatorInfo[] = [];
    let offset = 0;
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      const chunk = slice.subarray(offset, offset + SINGLE_VALIDATOR_SIZE);
      offset += SINGLE_VALIDATOR_SIZE;
      const valInfo = decodeOneValidator(chunk);
      validators.push(valInfo);
    }
    return validators;
  },
] as unknown as Codec<ValidatorInfo[]>;

ValidatorsInfoCodec.enc = ValidatorsInfoCodec[0];
ValidatorsInfoCodec.dec = ValidatorsInfoCodec[1];


/**
 * Example sub-encoders/decoders for a single validator (336 bytes).
 *   bandersnatch => 32 bytes
 *   ed25519 => 32 bytes
 *   bls => 144 bytes
 *   metadata => 128 bytes
 */
function encodeOneValidator(val: ValidatorInfo): Uint8Array {
  const out = new Uint8Array(336);
  if (val.bandersnatch.length !== 32) {
    throw new Error("bandersnatch must be 32 bytes");
  }
  out.set(val.bandersnatch, 0);

  if (val.ed25519.length !== 32) {
    throw new Error("ed25519 must be 32 bytes");
  }
  out.set(val.ed25519, 32);

  if (val.bls.length !== 144) {
    throw new Error("bls must be 144 bytes");
  }
  out.set(val.bls, 64);

  if (val.metadata.length !== 128) {
    throw new Error("metadata must be 128 bytes");
  }
  out.set(val.metadata, 208);

  return out;
}

function decodeOneValidator(data: Uint8Array): ValidatorInfo {
  if (data.length !== 336) {
    throw new Error(
      `decodeOneValidator: expected 336 bytes, got ${data.length}`
    );
  }
  return {
    bandersnatch: data.slice(0, 32),
    ed25519: data.slice(32, 64),
    bls: data.slice(64, 208),
    metadata: data.slice(208, 336),
  };
}