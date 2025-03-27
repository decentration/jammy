import { Codec } from "scale-ts";
import { decodeWithBytesUsed } from "../../../codecs";
import { concatAll, toUint8Array } from "../../../codecs/utils";
import { PreimagesInput, PreimagesOutput, PreimagesState, PreimagesStf } from "../types";
import { PreimagesInputCodec } from "./PreimagesInputCodec";
import { PreimagesOutputCodec } from "./PreimagesOutputCodec";
import { PreimagesStateCodec } from "./PreimagesStateCodec";


export const PreimagesStfCodec: Codec<PreimagesStf> = [
    // ENCODER
    (testCase: PreimagesStf): Uint8Array => {
      const encInput = PreimagesInputCodec.enc(testCase.input);
      const encPreState = PreimagesStateCodec.enc(testCase.pre_state);
      const encOutput = PreimagesOutputCodec.enc(testCase.output);
      const encPostState = PreimagesStateCodec.enc(testCase.post_state);
      return concatAll(encInput, encPreState, encOutput, encPostState);
    },
  
    // DECODER
    (data: ArrayBuffer | Uint8Array | string): PreimagesStf => {
      const uint8 = toUint8Array(data);
      let offset = 0;
  
      // input
      {
        const slice = uint8.slice(offset);
        const { value: input, bytesUsed } = decodeWithBytesUsed(PreimagesInputCodec, slice);
        offset += bytesUsed;
        var input_ = input;
      }
  
      // pre_state
      {
        const slice = uint8.slice(offset);
        const { value: preState, bytesUsed } = decodeWithBytesUsed(PreimagesStateCodec, slice);
        offset += bytesUsed;
        var pre_state_ = preState;
      }
  
      // output
      {
        const slice = uint8.slice(offset);
        const { value: output, bytesUsed } = decodeWithBytesUsed(PreimagesOutputCodec, slice);
        offset += bytesUsed;
        var output_ = output;
      }
  
      // post_state
      {
        const slice = uint8.slice(offset);
        const { value: postState, bytesUsed } = decodeWithBytesUsed(PreimagesStateCodec, slice);
        offset += bytesUsed;
        var post_state_ = postState;
      }
  
      if (offset < uint8.length) {
        console.warn(
          `PreimagesStfCodec: leftover bytes (offset=${offset}, total=${uint8.length})`
        );
      }
  
      return {
        input: input_ as PreimagesInput,
        pre_state: pre_state_ as PreimagesState,
        output: output_ as PreimagesOutput,
        post_state: post_state_ as PreimagesState,
      };
    },
  ] as unknown as Codec<PreimagesStf>;
  
  PreimagesStfCodec.enc = PreimagesStfCodec[0];
  PreimagesStfCodec.dec = PreimagesStfCodec[1];
  
  