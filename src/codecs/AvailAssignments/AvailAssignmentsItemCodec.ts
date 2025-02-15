import { Codec } from "scale-ts";
import { AvailAssignment } from "../../types/types";
import { AvailAssignmentCodec } from "./AvailAssignmentCodec";

/**
 * AvailAssignmentsItemCodec:
 * Encodes/decodes a single AvailabilityAssignmentsItem (null or AvailAssignment).
 */
export const AvailAssignmentsItemCodec: Codec<AvailAssignment | null> = [
  // ENCODER
  (item: AvailAssignment | null): Uint8Array => {
    if (item === null) {
      // Encode None choice with tag [0]
      return new Uint8Array([0x00]);
    } else {
      // Encode Some with tag [1] followed by AvailAssignment data
      const encAssignment = AvailAssignmentCodec.enc(item);
      const out = new Uint8Array(1 + encAssignment.length);
      out[0] = 0x01; // Tag for `some`
      out.set(encAssignment, 1);
      return out;
    }
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AvailAssignment | null => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length === 0) {
      throw new Error("AvailAssignmentsItemCodec.dec: no data to decode");
    }

    const tag = uint8[0];
   // console.log("avail assignment tag: ", tag);
    if (tag === 0x00) {
      // None
      return null;
    } else if (tag === 0x01) {
        // Some
      const slice = uint8.slice(1);
      return AvailAssignmentCodec.dec(slice);
    } else {
      throw new Error(`AvailAssignmentsItemCodec.dec: invalid tag 0x${tag.toString(16)}`);
    }
  },
] as Codec<AvailAssignment | null>;

AvailAssignmentsItemCodec.enc = AvailAssignmentsItemCodec[0];
AvailAssignmentsItemCodec.dec = AvailAssignmentsItemCodec[1];
