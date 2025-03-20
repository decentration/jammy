import { Codec, Bytes } from "scale-ts";
import { EpochMark, BandersnatchPublic, BandersnatchPublicCodec } from "../types/types";
import { VALIDATOR_COUNT } from "../consts";
import { concatAll, toUint8Array } from "../codecs/utils";

/**
 * We require:
 *   - 32 bytes for `entropy`
 *   - 32 bytes for `tickets_entropy`
 *   - `VALIDATOR_COUNT` bandersnatch public keys, each 32 bytes
 */
export const EpochMarkCodec: Codec<EpochMark> = [
  // ENCODER
  (mark: EpochMark): Uint8Array => {
    console.log("EpochMarkCodec: enc =>", mark);

    // 1) 32 bytes => entropy
    if (mark.entropy.length !== 32) {
      throw new Error(`EpochMarkCodec: 'entropy' must be 32 bytes`);
    }
    const encEntropy = Bytes(32).enc(mark.entropy);

    // 2) 32 bytes => tickets_entropy
    if (mark.tickets_entropy.length !== 32) {
      throw new Error(`EpochMarkCodec: 'tickets_entropy' must be 32 bytes`);
    }
    const encTicketsEntropy = Bytes(32).enc(mark.tickets_entropy);

    // 3) validators => exactly VALIDATOR_COUNT bandersnatch keys
    if (mark.validators.length !== VALIDATOR_COUNT) {
      throw new Error(
        `EpochMarkCodec: expected ${VALIDATOR_COUNT} validators, got ${mark.validators.length}`
      );
    }
    // each validator => 32 bytes => BandersnatchPublicCodec
    const encodedValidators: Uint8Array[] = [];
    for (let i = 0; i < mark.validators.length; i++) {
      const val = mark.validators[i];
      const encVal = BandersnatchPublicCodec.enc(val);
      encodedValidators.push(encVal);
    }

    return concatAll(encEntropy, encTicketsEntropy, ...encodedValidators);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): EpochMark => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    // 1) 32 bytes => entropy
    if (offset + 32 > uint8.length) {
      throw new Error(`EpochMarkCodec: not enough data for 'entropy' (need 32)`);
    }
    const entropy = uint8.slice(offset, offset + 32);
    offset += 32;

    // 2) 32 bytes => tickets_entropy
    if (offset + 32 > uint8.length) {
      throw new Error(`EpochMarkCodec: not enough data for 'tickets_entropy' (need 32)`);
    }
    const tickets_entropy = uint8.slice(offset, offset + 32);
    offset += 32;

    // 3) validators => exactly VALIDATOR_COUNT x 32
    const validators: BandersnatchPublic[] = [];
    const needed = VALIDATOR_COUNT * 32;
    if (offset + needed > uint8.length) {
      throw new Error(
        `EpochMarkCodec: not enough data for ${VALIDATOR_COUNT} validators => need ${needed}, got ${uint8.length - offset}`
      );
    }
    for (let i = 0; i < VALIDATOR_COUNT; i++) {
      // decode exactly 32 bytes per validator
      const sliceVal = uint8.slice(offset, offset + 32);
      offset += 32;
      // decode the bandersnatch pub key
      const val = BandersnatchPublicCodec.dec(sliceVal);
      validators.push(val);
    }

    return { entropy, tickets_entropy, validators };
  },
] as unknown as Codec<EpochMark>;

EpochMarkCodec.enc = EpochMarkCodec[0];
EpochMarkCodec.dec = EpochMarkCodec[1];
