import { Codec } from "scale-ts";
import { ValidatorInfo } from "../../types"; 

/**
 * ValidatorInfoCodec:
 *   - bandersnatch: 32 bytes
 *   - ed25519: 32 bytes
 *   - bls: 144 bytes
 *   - metadata: 128 bytes 
 */
export const ValidatorInfoCodec: Codec<ValidatorInfo> = (() => {
  const encode = (val: ValidatorInfo): Uint8Array => {
    if (!val.bandersnatch || val.bandersnatch.length !== 32) {
      throw new Error("ValidatorInfoCodec: bandersnatch must be 32 bytes");
    }
    if (!val.ed25519 || val.ed25519.length !== 32) {
      throw new Error("ValidatorInfoCodec: ed25519 must be 32 bytes");
    }
    if (!val.bls || val.bls.length !== 144) {
      throw new Error("ValidatorInfoCodec: bls must be 144 bytes");
    }
    if (!val.metadata || val.metadata.length !== 128) {
      throw new Error("ValidatorInfoCodec: metadata must be 128 bytes");
    }

    const out = new Uint8Array(336);
    out.set(val.bandersnatch, 0);
    out.set(val.ed25519, 32);
    out.set(val.bls, 64);
    out.set(val.metadata, 64 + 144);

    return out;
  };

  const decode = (data: ArrayBuffer | Uint8Array | string): ValidatorInfo => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 336) {
      throw new Error(
        `ValidatorInfoCodec: not enough data, expected at least 336 bytes, got ${uint8.length}.`
      );
    }

    // bandersnatch => bytes [0..32)
    const bandersnatch = uint8.slice(0, 32);
    // ed25519 => bytes [32..64)
    const ed25519 = uint8.slice(32, 64);
    // bls => bytes [64..208)
    const bls = uint8.slice(64, 208);
    // metadata => bytes [208..336)
    const metadata = uint8.slice(208, 336);

    return { bandersnatch, ed25519, bls, metadata };
  };

  const codec = [encode, decode] as Codec<ValidatorInfo>;
  codec.enc = encode;
  codec.dec = decode;
  return codec;
})();
