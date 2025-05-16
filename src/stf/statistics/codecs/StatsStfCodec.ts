import { Codec } from "scale-ts";
import { concatAll, decodeWithBytesUsed, toUint8Array } from "../../../codecs";
import { StatsOutputCodec } from "./StatsOutputCodec";
import { StatsStateCodec } from "./StatsStateCodec";
import { StatsStf } from "../types";
import { StatsInputCodec } from "./StatsInputCodec";


export const StatsStfCodec: Codec<StatsStf> = [
    (input: StatsStf): Uint8Array => {
      const encInput = StatsInputCodec.enc(input.input);
      const encPre = StatsStateCodec.enc(input.pre_state);
      const encOut = StatsOutputCodec.enc(input.output);
      const encPost = StatsStateCodec.enc(input.post_state);
      return concatAll(encInput, encPre, encOut, encPost);
    },
    (data: ArrayBuffer| Uint8Array | string): StatsStf => {
      let offset = 0;
      const uint8 = toUint8Array(data);
  
      
      // input
      {
        const slice = uint8.slice(offset);
        const { value: inputVal, bytesUsed } = decodeWithBytesUsed(StatsInputCodec, slice);
        offset += bytesUsed;
        // console.log("Decoded StatsInput => used=", bytesUsed, " offset now=", offset);

        var input_ = inputVal;
      }


      // pre_state
      {
        const slice = uint8.slice(offset);
        const { value: preVal, bytesUsed } = decodeWithBytesUsed(StatsStateCodec, slice);
        offset += bytesUsed;
        // console.log("Decoded StatsState => used=", bytesUsed, " offset now=", offset);
        var pre_state_ = preVal;
      }
  
      // output
      {
        const slice = uint8.slice(offset);
        const { value: output, bytesUsed } = decodeWithBytesUsed(StatsOutputCodec, slice);
        offset += bytesUsed;
        var output_ = output;
      }
  
      // post_state
      {
        const slice = uint8.slice(offset);
        const { value: post_state, bytesUsed } = decodeWithBytesUsed(StatsStateCodec, slice);
        offset += bytesUsed;
        var post_state_ = post_state;
      }
  
      // check for leftover bytes
      if (offset < uint8.length) {
        console.warn(`StatsStfCodec: leftover bytes: used=${offset}, total=${uint8.length}`);
      }
  
      return {
        input: input_,
        pre_state: pre_state_,
        output: output_,
        post_state: post_state_,
      };
    },
  ] as unknown as Codec<StatsStf>;
  StatsStfCodec.enc = StatsStfCodec[0];
  StatsStfCodec.dec = StatsStfCodec[1];
  