import { Codec } from "scale-ts";
import { OptionCodec } from "../../../codecs/utils/OptionCodec";

/** Encode/decode exactly 12 of them. */
const GammaSInnerCodec: Codec<Uint8Array[]> = [
  // ENCODER
  (keys: Uint8Array[]): Uint8Array => {
    if (keys.length !== 12) {
      throw new Error(`GammaSInnerCodec: expected 12 keys, got ${keys.length}`);
    }

    // total size = 12 * 32 = 384 bytes
    const out = new Uint8Array(384);
    let offset = 0;
    for (let i = 0; i < 12; i++) {
      const key = keys[i];
      if (key.length !== 32) {
        throw new Error(`Key #${i} is not 32 bytes`);
      }
      out.set(key, offset);
      offset += 32;
    }
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Uint8Array[] => {
    const uint8 = data instanceof Uint8Array
      ? data
      : typeof data === "string"
      ? new TextEncoder().encode(data)
      : new Uint8Array(data);

    if (uint8.length !== 384) {
      throw new Error(`GammaSInnerCodec: expected exactly 384 bytes for 12 keys, got ${uint8.length}`);
    }
    const keys: Uint8Array[] = [];
    let offset = 0;
    for (let i = 0; i < 12; i++) {
      const chunk = uint8.slice(offset, offset + 32);
      offset += 32;
      keys.push(chunk);
    }
    return keys;
  },
] as unknown as Codec<Uint8Array[]>;

GammaSInnerCodec.enc = GammaSInnerCodec[0];
GammaSInnerCodec.dec = GammaSInnerCodec[1];

export const GammaSCodec = OptionCodec(GammaSInnerCodec);
