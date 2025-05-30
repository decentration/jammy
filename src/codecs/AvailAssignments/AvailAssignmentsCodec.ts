import { Codec } from "scale-ts";
import { AvailAssignment } from "../../types/types";
import { AvailAssignmentsItemCodec } from "./AvailAssignmentsItemCodec";
import { decodeWithBytesUsed } from "..";
import { CORES_COUNT } from "../../consts";

/**
 * AvailAssignmentsCodec:
 * Encodes/decodes a fixed-size array of AvailabilityAssignmentsItem.
 * Size is determined by `CORES_COUNT`.
 */

type AvailAssignmentsArray = (AvailAssignment |null)[];
export const AvailAssignmentsCodec: Codec<AvailAssignmentsArray> = [
  // ENCODER
  (assignments: AvailAssignmentsArray): Uint8Array => {
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
  (data: ArrayBuffer | Uint8Array | string): AvailAssignmentsArray => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    const assignments: AvailAssignmentsArray = [];
    let offset = 0;

    for (let i = 0; i < CORES_COUNT; i++) {
      const slice = uint8.slice(offset);
      const { value: item, bytesUsed } = decodeWithBytesUsed(AvailAssignmentsItemCodec, slice);
      assignments.push(item);
      offset += bytesUsed;
    }

    // console.log("avail assignments: ", assignments);

    // check for leftover
    if (offset < uint8.length) {
      console.warn(
        `AvailAssignmentsCodec.dec: leftover bytes after decoding ${CORES_COUNT} items`
      );
    }

    return assignments;
  },
] as Codec<AvailAssignmentsArray>;

AvailAssignmentsCodec.enc = AvailAssignmentsCodec[0];
AvailAssignmentsCodec.dec = AvailAssignmentsCodec[1];
