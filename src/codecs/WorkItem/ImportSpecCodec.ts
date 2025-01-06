import { Codec } from "scale-ts";
import { ImportSpec } from "../../types/types";

export const ImportSpecCodec: Codec<ImportSpec> = [
  // ENCODER
  (spec: ImportSpec): Uint8Array => {
    // tree_root (32 bytes) + index (u16, 2 bytes)
    const out = new Uint8Array(32 + 2);
    out.set(spec.tree_root, 0);

    const dv = new DataView(out.buffer);
    dv.setUint16(32, spec.index, true); // little-endian = true

    return out;
  },

  // DECODER
  (data: ArrayBuffer|Uint8Array|string): ImportSpec => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 34) {
      throw new Error("ImportSpecCodec: not enough data (need 34 bytes)");
    }

    const tree_root = uint8.slice(0, 32);
    const index = new DataView(
      uint8.buffer,
      uint8.byteOffset + 32,
      2
    ).getUint16(0, true);

    return { tree_root, index };
  },
] as Codec<ImportSpec>;

ImportSpecCodec.enc = ImportSpecCodec[0];
ImportSpecCodec.dec = ImportSpecCodec[1];
