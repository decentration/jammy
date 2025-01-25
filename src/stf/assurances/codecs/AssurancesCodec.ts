import { Codec } from "scale-ts";
import { Assurances } from "../types"; // Adjust the import path as necessary
import { StateCodec } from "./StateCodec/StateCodec";
import { InputCodec } from "./Input/InputCodec";
import { OutputCodec } from "./Output/OutputCodec";
import { decodeWithBytesUsed } from "../../../codecs";

/**
 * AssurancesCodec:
 * Encodes/decodes Assurances including:
 * - input: Encoded via InputCodec
 * - pre_state and post_state: Encoded via StateCodec
 * - output: Encoded via OutputCodec
 */
export const AssurancesCodec: Codec<Assurances> = [
  // ENCODER
  (assurances: Assurances): Uint8Array => {
    // Encode 
    const encInput = InputCodec.enc(assurances.input);
    const encPreState = StateCodec.enc(assurances.pre_state,);
    const encOutput = OutputCodec.enc(assurances.output);
    const encPostState = StateCodec.enc(assurances.post_state);
    const totalSize = encInput.length + encPreState.length + encOutput.length + encPostState.length;
    const out = new Uint8Array(totalSize);
    let offset = 0;

    out.set(encInput, offset);
    offset += encInput.length;
    out.set(encPreState, offset);
    offset += encPreState.length;
    out.set(encOutput, offset);
    offset += encOutput.length;
    out.set(encPostState, offset);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Assurances => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // Decode input
    const sliceInput = uint8.slice(offset);
    const { value: input, bytesUsed: bytesUsedInput } = decodeWithBytesUsed(
      InputCodec,
      sliceInput
    );
    offset += bytesUsedInput;

    // Decode pre_state
    const slicePreState = uint8.slice(offset);
    const { value: pre_state, bytesUsed: bytesUsedPreState } = decodeWithBytesUsed(
      StateCodec,
      slicePreState
    );
    offset += bytesUsedPreState;

    // Decode output
    const sliceOutput = uint8.slice(offset);
    const { value: output, bytesUsed: bytesUsedOutput } = decodeWithBytesUsed(
      OutputCodec,
      sliceOutput
    );
    offset += bytesUsedOutput;

    // Decode post_state
    const slicePostState = uint8.slice(offset);
    const { value: post_state, bytesUsed: bytesUsedPostState } = decodeWithBytesUsed(
      StateCodec,
      slicePostState
    );
    offset += bytesUsedPostState;

    // Check for leftover data
    if (offset < uint8.length) {
      console.warn(
        `AssurancesCodec.dec: leftover bytes after decoding (offset=${offset}, total=${uint8.length})`
      );
    }

    return {
      input,
      pre_state,
      output,
      post_state,
    };
  },
] as Codec<Assurances>;


AssurancesCodec.enc = AssurancesCodec[0];
AssurancesCodec.dec = AssurancesCodec[1];
