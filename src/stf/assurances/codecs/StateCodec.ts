// src/stf/assurances/codecs/StateCodec.ts

import { Codec } from "scale-ts";
import { State } from "../types"; // Adjust the import path as necessary
import { AvailAssignmentsCodec } from "./AvailAssignments";
import { CurrValidatorsCodec } from "./CurrValidatorsCodec"; // Ensure this codec is correctly defined
import { decodeWithBytesUsed } from "../../../codecs";

/**
 * StateCodec:
 * Encodes/decodes `State` including:
 * - `avail_assignments`: Fixed-size array of AvailabilityAssignmentsItem
 * - `curr_validators`: Encoded via CurrValidatorsCodec
 */
export const StateCodec: Codec<State> = [
  // ENCODER
  (state: State): Uint8Array => {
    // Encode
    const encAvailAssignments = AvailAssignmentsCodec.enc(state.avail_assignments);
    const encCurrValidators = CurrValidatorsCodec.enc(state.curr_validators);

    // Concatenate
    const totalSize = encAvailAssignments.length + encCurrValidators.length;
    const out = new Uint8Array(totalSize);
    out.set(encAvailAssignments, 0);
    out.set(encCurrValidators, encAvailAssignments.length);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): State => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // Decode
    const sliceAvailAssignments = uint8.slice(offset);
    const { value: avail_assignments, bytesUsed: bytesUsedAvail } = decodeWithBytesUsed(
      AvailAssignmentsCodec,
      sliceAvailAssignments
    );
    offset += bytesUsedAvail;

    const sliceCurrValidators = uint8.slice(offset);
    const { value: curr_validators, bytesUsed: bytesUsedValidators } = decodeWithBytesUsed(
      CurrValidatorsCodec,
      sliceCurrValidators
    );
    offset += bytesUsedValidators;

    console.log("state data: ", Buffer.from(uint8).toString("hex"));
    // Check for leftover data
    if (offset < uint8.length) {
      console.warn(
        `StateCodec.dec: leftover bytes after decoding (offset=${offset}, total=${uint8.length})`
      );
    }

    return {
      avail_assignments,
      curr_validators,
    };
  },
] as Codec<State>;

StateCodec.enc = StateCodec[0];
StateCodec.dec = StateCodec[1];
