import { Codec } from "scale-ts";
import { DisputesInput } from "../types";
import { DisputeCodec } from "../../../codecs/DisputeCodec"; 
import { decodeWithBytesUsed, toUint8Array, concatAll } from "../../../codecs";

export const DisputesInputCodec: Codec<DisputesInput> = [
  // ENCODER
  (input: DisputesInput): Uint8Array => {
    const encDispute = DisputeCodec.enc(input.disputes);
    // console.log("DisputesInputCodec: encoding", Buffer.from(encDispute).toString('hex'));
    return encDispute;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): DisputesInput => {
    const uint8 = toUint8Array(data);
    let offset = 0;
    const slice = uint8.slice(offset);
    {
      const { value: input, bytesUsed } = decodeWithBytesUsed(DisputeCodec, slice);
      offset += bytesUsed;
      return { disputes: input }; 
    }
  },

 
] as unknown as Codec<DisputesInput>;

DisputesInputCodec.enc = DisputesInputCodec[0];
DisputesInputCodec.dec = DisputesInputCodec[1];
