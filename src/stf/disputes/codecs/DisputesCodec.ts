import { Codec } from "scale-ts";
import { Disputes } from "../types"; 
import { DisputesInputCodec } from "./InputCodec";
import { DisputesStateCodec } from "./StateCodec";
import { OutputCodec } from "./OutputCodec";
import { decodeWithBytesUsed, toUint8Array, concatAll } from "../../../codecs";


export const DisputesCodec: Codec<Disputes> = [
  // ENCODER
  (value: Disputes): Uint8Array => {
    const encInput = DisputesInputCodec.enc(value.input);
    const encPre = DisputesStateCodec.enc(value.pre_state);
    const encOutput = OutputCodec.enc(value.output);
    const encPost = DisputesStateCodec.enc(value.post_state);

    return concatAll(encInput, encPre, encOutput, encPost);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Disputes => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    // 1) decode input
    {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(DisputesInputCodec, slice);

      offset += bytesUsed;

      var input = value;
    }

    // 2) decode pre_state
    {
      const { value, bytesUsed } = decodeWithBytesUsed(DisputesStateCodec, uint8.slice(offset));
      offset += bytesUsed;
      var pre_state = value;
    }

    // 3) decode output
    {
      const { value, bytesUsed } = decodeWithBytesUsed(OutputCodec, uint8.slice(offset));
      offset += bytesUsed;
      var output = value;
    }

    // 4) decode post_state
    {
      const { value, bytesUsed } = decodeWithBytesUsed(DisputesStateCodec, uint8.slice(offset));
      offset += bytesUsed;
      var post_state = value;
    }

    // leftover check
    // if (offset < uint8.length) {
    //   console.warn(`DisputesCodec: leftover data? offset=${offset}, total=${uint8.length}`);
    // }

    return { input, pre_state, output, post_state };
  },
] as unknown as Codec<Disputes>;

DisputesCodec.enc = DisputesCodec[0];
DisputesCodec.dec = DisputesCodec[1];
