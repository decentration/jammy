import { Codec, Bytes } from "scale-ts";
import { VarLenBytesCodec, toUint8Array, decodeWithBytesUsed, DiscriminatorCodec, concatAll } from "../../../codecs";
import { PreimagesBlobItem } from "../types";

// export interface PreimagesBlobItem {
//     hash: OpaqueHash, // 32 bytes
//     blob: Uint8Array, // many bytes nt a number

// } 
export const PreimagesBlobItemCodec: Codec<PreimagesBlobItem> = [
  // ENCODER
  (data: PreimagesBlobItem): Uint8Array => {
    const encHash = Bytes(32).enc(data.hash);
    const encBlob = VarLenBytesCodec.enc(data.blob);

    return concatAll(encHash, encBlob);
  }
  // DECODER
  , (input: ArrayBuffer | Uint8Array | string): PreimagesBlobItem => {
    const uint8 = toUint8Array(input);
    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    // const blob = read(VarLenBytesCodec);

    const hash = read(Bytes(32));
    const blob = read(VarLenBytesCodec);  
    return { hash, blob };
  },
] as unknown as Codec<PreimagesBlobItem>;

PreimagesBlobItemCodec.enc = PreimagesBlobItemCodec[0];
PreimagesBlobItemCodec.dec = PreimagesBlobItemCodec[1];
  
export const PreimagesBlobCodec = DiscriminatorCodec(PreimagesBlobItemCodec);


