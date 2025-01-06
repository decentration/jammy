import { Codec } from "scale-ts";
import { ExtrinsicSpec } from "../../types/types";

export const ExtrinsicSpecCodec: Codec<ExtrinsicSpec> = [
  // ENCODER
  (spec: ExtrinsicSpec): Uint8Array => {
    // 32 bytes for hash + 4 bytes (u32) for len
    const out = new Uint8Array(32 + 4);
    out.set(spec.hash, 0);
    const dv = new DataView(out.buffer);
    dv.setUint32(32, spec.len, true);
    return out;
  },

  // DECODER
  (data: ArrayBuffer|Uint8Array|string): ExtrinsicSpec => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);
    if (uint8.length < 36) {
      throw new Error("ExtrinsicSpecCodec: not enough bytes (need 36)");
    }

    const hash = uint8.slice(0, 32);
    const len = new DataView(
      uint8.buffer,
      uint8.byteOffset + 32,
      4
    ).getUint32(0, true);

    return { hash, len };
  },
] as Codec<ExtrinsicSpec>;

ExtrinsicSpecCodec.enc = ExtrinsicSpecCodec[0];
ExtrinsicSpecCodec.dec = ExtrinsicSpecCodec[1];
