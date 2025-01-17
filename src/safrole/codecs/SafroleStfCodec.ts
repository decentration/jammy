import { Codec } from "scale-ts";
import { SafroleInput, SafroleOutput, SafroleState, SafroleStf } from "../types";  
import { SafroleInputCodec } from "./SafroleInputCodec";
import { SafroleStateCodec } from "./SafroleStateCodec";
import { SafroleOutputCodec } from "./SafroleOutputCodec";
import { decodeWithBytesUsed } from "../../codecs";
import { concatAll, toUint8Array } from "../../codecs/utils";

export const SafroleStfCodec: Codec<SafroleStf> = [
  // ENCODER
  (testCase: SafroleStf): Uint8Array => {
    const encInput = SafroleInputCodec.enc(testCase.input);
    const encPreState = SafroleStateCodec.enc(testCase.pre_state);
    const encOutput = SafroleOutputCodec.enc(testCase.output);
    const encPostState = SafroleStateCodec.enc(testCase.post_state);

    return concatAll(encInput, encPreState, encOutput, encPostState);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): SafroleStf => {
    const uint8 = toUint8Array(data);

    let offset = 0;

    // 1) input
    {
      const slice = uint8.slice(offset);
      const { value: input, bytesUsed } = decodeWithBytesUsed(SafroleInputCodec, slice);
      offset += bytesUsed;
      var input_ = input as SafroleInput;
    }

    // 2) pre_state
    {
      const slice = uint8.slice(offset);
      const { value: pre_state, bytesUsed } = decodeWithBytesUsed(SafroleStateCodec, slice);
      offset += bytesUsed;
      var pre_state_ = pre_state as SafroleState;
    }

    // 3) output
    {
      const slice = uint8.slice(offset);
      const { value: output, bytesUsed } = decodeWithBytesUsed(SafroleOutputCodec, slice);
      offset += bytesUsed;
      var output_ = output as SafroleOutput;
    }

    // 4) post_state
    {
      const slice = uint8.slice(offset);
      const { value: post_state, bytesUsed } = decodeWithBytesUsed(SafroleStateCodec, slice);
      offset += bytesUsed;
      var post_state_ = post_state as SafroleState;
    }

    if (offset < uint8.length) {
      console.warn(
        `SafroleStfCodec: leftover bytes (offset=${offset}, total=${uint8.length})`
      );
    }

    return {
      input: input_,
      pre_state: pre_state_,
      output: output_,
      post_state: post_state_,
    };
  },
] as unknown as Codec<SafroleStf>;

SafroleStfCodec.enc = SafroleStfCodec[0];
SafroleStfCodec.dec = SafroleStfCodec[1];
