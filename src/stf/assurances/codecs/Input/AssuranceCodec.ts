
import { Codec } from "scale-ts";
import { Assurance } from "../../../../types/types";
import { decodeWithBytesUsed } from "../../../../codecs"; // Ensure correct path
import { BITFIELD_LENGTH } from "../../../../consts/tiny";


/**
 * AssuranceCodec:
 * Encodes/decodes a single Assurance.
 * Structure:
 * - anchor: 32 bytes
 * - bitfield: BITFIELD_LENGTH bytes
 * - validator_index: 2 bytes (Little Endian)
 * - signature: 64 bytes
 */
export const AssuranceCodec: Codec<Assurance> = [
  // ENCODER
  (assurance: Assurance): Uint8Array => {
    // Validate 
    if (assurance.anchor.length !== 32) {
      throw new Error(`AssuranceCodec.enc: anchor must be 32 bytes, got ${assurance.anchor.length}`);
    }

    if (assurance.bitfield.length !== BITFIELD_LENGTH) {
      throw new Error(`AssuranceCodec.enc: bitfield must be ${BITFIELD_LENGTH} bytes, got ${assurance.bitfield.length}`);
    }
    if (assurance.signature.length !== 64) {
      throw new Error(`AssuranceCodec.enc: signature must be 64 bytes, got ${assurance.signature.length}`);
    }
    if (assurance.validator_index < 0 || assurance.validator_index > 0xFFFF) {
      throw new Error(`AssuranceCodec.enc: validator_index must be a u16, got ${assurance.validator_index}`);
    }

    // Encode validator_index as 2 bytes LE
    const validatorIndexBuf = new Uint8Array(2);
    new DataView(validatorIndexBuf.buffer).setUint16(0, assurance.validator_index, true);

    const out = new Uint8Array(
      assurance.anchor.length +
      assurance.bitfield.length +
      validatorIndexBuf.length +
      assurance.signature.length
    );
    let offset = 0;
    out.set(assurance.anchor, offset);       offset += assurance.anchor.length;
    out.set(assurance.bitfield, offset);     offset += assurance.bitfield.length;
    out.set(validatorIndexBuf, offset);       offset += validatorIndexBuf.length;
    out.set(assurance.signature, offset);     // No need to increment offset further

    return out;
  },

  // DECODER
  (input: ArrayBuffer | Uint8Array | string): Assurance => {
    const uint8 =
      input instanceof Uint8Array
        ? input
        : typeof input === "string"
        ? new TextEncoder().encode(input)
        : new Uint8Array(input);

    let offset = 0;

    // DECODE anchor 
    if (offset + 32 > uint8.length) {
      throw new Error("AssuranceCodec.dec: insufficient data for anchor");
    }
    const anchor = uint8.slice(offset, offset + 32);
    offset += 32;

    // DECODE bitfield
    const BITFIELD_LENGTH = 1; // Define based on your specification
    if (offset + BITFIELD_LENGTH > uint8.length) {
      throw new Error("AssuranceCodec.dec: insufficient data for bitfield");
    }
    const bitfield = uint8.slice(offset, offset + BITFIELD_LENGTH);
    offset += BITFIELD_LENGTH;

    // Decode validator_index
    if (offset + 2 > uint8.length) {
      throw new Error("AssuranceCodec.dec: insufficient data for validator_index");
    }
    const validatorIndexView = new DataView(uint8.buffer, uint8.byteOffset + offset, 2);
    const validator_index = validatorIndexView.getUint16(0, true); // Little Endian
    offset += 2;

    // Decode signature
    if (offset + 64 > uint8.length) {
      throw new Error("AssuranceCodec.dec: insufficient data for signature");
    }
    const signature = uint8.slice(offset, offset + 64);
    offset += 64;

    return {
      anchor,
      bitfield,
      validator_index,
      signature,
    };
  },
] as Codec<Assurance>;

AssuranceCodec.enc = AssuranceCodec[0];
AssuranceCodec.dec = AssuranceCodec[1];
