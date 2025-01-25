import { Codec } from "scale-ts";
import { AvailAssignment } from "../../../types"; // Adjust the import path as necessary
import { AvailAssignmentsItemCodec } from "./AvailAssignmentsItemCodec";
import { decodeWithBytesUsed } from "../../../../codecs";
import { CORES_COUNT } from "../../../../consts/tiny"; // Ensure this constant is defined

/**
 * AvailAssignmentsCodec:
 * Encodes/decodes a fixed-size array of AvailabilityAssignmentsItem.
 * Size is determined by `CORES_COUNT`.
 */
export const AvailAssignmentsCodec: Codec<Array<AvailAssignment | null>> = [
  // ENCODER
  (assignments: Array<AvailAssignment | null>): Uint8Array => {
    if (assignments.length !== CORES_COUNT) {
      throw new Error(
        `AvailAssignmentsCodec.enc: expected exactly ${CORES_COUNT} items, got ${assignments.length}`
      );
    }

    // Encode each item and concatenate
    const encodedItems = assignments.map((item) => AvailAssignmentsItemCodec.enc(item));
    const totalSize = encodedItems.reduce((acc, buf) => acc + buf.length, 0);
    const out = new Uint8Array(totalSize);
    let offset = 0;

    for (const enc of encodedItems) {
      out.set(enc, offset);
      offset += enc.length;
    }

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Array<AvailAssignment | null> => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    const assignments: Array<AvailAssignment | null> = [];
    let offset = 0;

    for (let i = 0; i < CORES_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: item, bytesUsed } = decodeWithBytesUsed(AvailAssignmentsItemCodec, slice);
      assignments.push(item);
      offset += bytesUsed;
    }

    // check for leftover
    if (offset < uint8.length) {
      console.warn(
        `AvailAssignmentsCodec.dec: leftover bytes after decoding ${CORES_COUNT} items`
      );
    }

    return assignments;
  },
] as Codec<Array<AvailAssignment | null>>;

AvailAssignmentsCodec.enc = AvailAssignmentsCodec[0];
AvailAssignmentsCodec.dec = AvailAssignmentsCodec[1];
