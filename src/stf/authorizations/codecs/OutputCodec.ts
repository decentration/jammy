import { Codec } from "scale-ts";

export const OutputCodec: Codec<null> = [
    // ENCODER
    (): Uint8Array => {
      // zero-length
      return new Uint8Array([]);
    },
  
    // DECODER
    (data: ArrayBuffer | Uint8Array | string): null => {
      return null;
    },
  ] as unknown as Codec<null>;
  
  OutputCodec.enc = OutputCodec[0];
  OutputCodec.dec = OutputCodec[1];
  