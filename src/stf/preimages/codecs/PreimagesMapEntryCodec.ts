import { Codec } from "scale-ts";
import { VarLenBytesCodec } from "../../../codecs/VarLenBytesCodec";
import { decodeWithBytesUsed } from "../../../codecs";
import { toUint8Array, concatAll } from "../../../codecs/utils";
import { PreimagesMapEntry } from "../types";

export const PreimagesMapEntryCodec: Codec<PreimagesMapEntry> = [
  // ENCODER
  (entry: PreimagesMapEntry): Uint8Array => {
    if (entry.hash.length !== 32) {
      throw new Error(`PreimagesMapEntryCodec: hash must be 32 bytes`);
    }
    const blobEnc = VarLenBytesCodec.enc(entry.blob);

    return concatAll(entry.hash, blobEnc);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): PreimagesMapEntry => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    if (uint8.length < 32) {
      throw new Error(
        `PreimagesMapEntryCodec: insufficient data for hash (need 32 bytes, got ${uint8.length})`
      );
    }
    const hash = uint8.slice(offset, offset + 32);
    offset += 32;

    const slice = uint8.slice(offset);
    const { value: blob, bytesUsed } = decodeWithBytesUsed(VarLenBytesCodec, slice);
    offset += bytesUsed;

    return { hash, blob };
  },
] as unknown as Codec<PreimagesMapEntry>;

PreimagesMapEntryCodec.enc = PreimagesMapEntryCodec[0];
PreimagesMapEntryCodec.dec = PreimagesMapEntryCodec[1];
