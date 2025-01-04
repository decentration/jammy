import { Codec } from 'scale-ts';
import { Fault, Ed25519Signature, Ed25519SignatureCodec} from '../types/types';

const FAULT_TARGET_SIZE = 32;
const FAULT_KEY_SIZE = 32;
const FAULT_BOOL_SIZE = 1; // 1 byte in SCALE

/**
 * We assume:
 *   - target: 32 bytes
 *   - vote: 1 byte (SCALE-encoded boolean)
 *   - key: 32 bytes
 *   - signature: exactly 64 bytes from Ed25519SignatureCodec
 */
export const FaultCodec: Codec<Fault> = [
  // enc
  (fault: Fault) => {
    if (fault.target.length !== FAULT_TARGET_SIZE) {
      throw new Error(`FaultCodec enc: target must be ${FAULT_TARGET_SIZE} bytes`);
    }
    if (fault.key.length !== FAULT_KEY_SIZE) {
      throw new Error(`FaultCodec enc: key must be ${FAULT_KEY_SIZE} bytes`);
    }

    // encode the boolean as 0x01 or 0x00
    const voteByte = new Uint8Array([fault.vote ? 1 : 0]);

    // encode signature
    const encodedSig = Ed25519SignatureCodec.enc(fault.signature);

    const out = new Uint8Array(
      FAULT_TARGET_SIZE + FAULT_BOOL_SIZE + FAULT_KEY_SIZE + encodedSig.length
    );

    // copy target
    out.set(fault.target, 0);

    // copy vote
    out.set(voteByte, FAULT_TARGET_SIZE);

    // copy key
    out.set(fault.key, FAULT_TARGET_SIZE + FAULT_BOOL_SIZE);

    // copy signature
    out.set(encodedSig, FAULT_TARGET_SIZE + FAULT_BOOL_SIZE + FAULT_KEY_SIZE);

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

    // must have at least 32 + 1 + 32 = 65 bytes before signature
    if (uint8.length < FAULT_TARGET_SIZE + FAULT_BOOL_SIZE + FAULT_KEY_SIZE) {
      throw new Error(
        `FaultCodec dec: not enough data for target+vote+key (need at least 65, got ${uint8.length})`
      );
    }

    const target = uint8.slice(0, FAULT_TARGET_SIZE);

    const voteByte = uint8[FAULT_TARGET_SIZE];
    const vote = voteByte === 1; // interpret 0 or 1

    const keyStart = FAULT_TARGET_SIZE + FAULT_BOOL_SIZE;
    const key = uint8.slice(keyStart, keyStart + FAULT_KEY_SIZE);

    const sigData = uint8.slice(keyStart + FAULT_KEY_SIZE);

    const signature = Ed25519SignatureCodec.dec(sigData);

    return { target, vote, key, signature };
  },
] as unknown as Codec<Fault>;


FaultCodec.enc = FaultCodec[0];
FaultCodec.dec = FaultCodec[1];
