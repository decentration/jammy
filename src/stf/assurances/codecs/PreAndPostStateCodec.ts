import { Codec } from "scale-ts";
import { CurrValidatorsCodec } from "./CurrValidatorsCodec";
import { decodeWithBytesUsed, DiscriminatorCodec } from "../../../codecs";
import { PreAndPostState } from "../types";
import { AvailAssignmentCodec } from "./AvailAssignmentCodec";
import { OptionCodec } from "../../../codecs"; // The generic option from above

export const PreAndPostStateCodec: Codec<PreAndPostState> = [
  // ENCODER
  (state: PreAndPostState): Uint8Array => {
    // 1) We want an array of (AvailAssignment | null) => 
    //    use DiscriminatorCodec(OptionCodec(AvailAssignmentCodec))
    const assignmentCodec = DiscriminatorCodec(OptionCodec(AvailAssignmentCodec));
    const encAvailAssignments = assignmentCodec.enc(state.avail_assignments);

    // 2) Encode validators
    const encCurrValidators = CurrValidatorsCodec.enc(state.curr_validators);

    // Concatenate
    const totalSize = encAvailAssignments.length + encCurrValidators.length;
    const out = new Uint8Array(totalSize);

    out.set(encAvailAssignments, 0);
    out.set(encCurrValidators, encAvailAssignments.length);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): PreAndPostState => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // 1) decode array of optional AvailAssignments
    const assignmentCodec = DiscriminatorCodec(OptionCodec(AvailAssignmentCodec));
    {
      const { value: availAssignments, bytesUsed } = decodeWithBytesUsed(
        assignmentCodec,
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var aAssignments = availAssignments;
    }

    // 2) decode curr_validators
    {
      const { value: currValidators, bytesUsed } = decodeWithBytesUsed(
        CurrValidatorsCodec,
        uint8.slice(offset)
      );
      offset += bytesUsed;
      var cValidators = currValidators;
    }

    // leftover check
    if (offset !== uint8.length) {
      throw new Error(
        `PreAndPostStateCodec: leftover bytes after decoding. offset=${offset}, total=${uint8.length}`
      );
    }

    return {
      avail_assignments: aAssignments,
      curr_validators: cValidators,
    };
  },
] as unknown as Codec<PreAndPostState>;

PreAndPostStateCodec.enc = PreAndPostStateCodec[0];
PreAndPostStateCodec.dec = PreAndPostStateCodec[1];
