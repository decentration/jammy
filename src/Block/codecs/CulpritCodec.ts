import { Codec } from 'scale-ts';
import { Culprit, BandersnatchSignature, Ed25519SignatureCodec } from '../types';

const CULPRIT_TARGET_SIZE = 32;
const CULPRIT_KEY_SIZE = 32;

/**
 * We assume:
 *   - target: 32 bytes
 *   - key: 32 bytes
 *   - signature: exactly 64 bytes from Ed25519SignatureCodec
 */
export const CulpritCodec: Codec<Culprit> = [
  // enc
  (culprit: Culprit) => {
    if (culprit.target.length !== CULPRIT_TARGET_SIZE) {
      throw new Error(`CulpritCodec enc: target must be ${CULPRIT_TARGET_SIZE} bytes`);
    }
    if (culprit.key.length !== CULPRIT_KEY_SIZE) {
      throw new Error(`CulpritCodec enc: key must be ${CULPRIT_KEY_SIZE} bytes`);
    }

    // Encode the bandersnatch signature (should be 64 bytes, but let's let that codec do the job)
    const encodedSig = Ed25519SignatureCodec.enc(culprit.signature);

    const out = new Uint8Array(CULPRIT_TARGET_SIZE + CULPRIT_KEY_SIZE + encodedSig.length);

    // copy target
    out.set(culprit.target, 0);

    // copy key
    out.set(culprit.key, CULPRIT_TARGET_SIZE);

    // copy signature
    out.set(encodedSig, CULPRIT_TARGET_SIZE + CULPRIT_KEY_SIZE);
// console.log('culrpit encoded out:', out);
    return out;
  },

  // dec
  (data: ArrayBuffer) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    // must have at least 32 + 32 = 64 bytes before signature
    if (uint8.length < CULPRIT_TARGET_SIZE + CULPRIT_KEY_SIZE) {
        console.log('culrpit dec data:', data);
      throw new Error(`CulpritCodec dec: not enough data for target+key (need 64, got ${uint8.length})`);
    }

    const target = uint8.slice(0, CULPRIT_TARGET_SIZE);
    const key = uint8.slice(CULPRIT_TARGET_SIZE, CULPRIT_TARGET_SIZE + CULPRIT_KEY_SIZE);

    const sigData = uint8.slice(CULPRIT_TARGET_SIZE + CULPRIT_KEY_SIZE);

    // let the Ed25519SignatureCodec handle the signature portion
    const signature = Ed25519SignatureCodec.dec(sigData);

    // return the structured culprit
    return { target, key, signature };
  },
] as unknown as Codec<Culprit>;


CulpritCodec.enc = CulpritCodec[0];
CulpritCodec.dec = CulpritCodec[1];
