import { Codec } from "scale-ts";
import { Preimage } from "../types/types";
import { VarLenBytesCodec, decodeWithBytesUsed } from ".";


export const PreimageCodec: Codec<Preimage> = [
    // 1) ENCODER
    (p: Preimage) => {
      // 1) encode `requester` as 4 bytes (little-endian)
      const requesterBuf = new Uint8Array(4);
      new DataView(requesterBuf.buffer).setUint32(0, p.requester, true);
  
      // 2) encode `blob` with single-byte-len
      const encBlob = VarLenBytesCodec.enc(p.blob);

  
      // 3) concatenate
      const out = new Uint8Array(requesterBuf.length + encBlob.length);
      out.set(requesterBuf, 0);
      out.set(encBlob, 4);
  
      return out;
    },
  
    // 2) DECODER
    (data: ArrayBuffer | Uint8Array | string) => {
      // convert input => Uint8Array
      const uint8 =
        data instanceof Uint8Array
          ? data
          : typeof data === "string"
          ? new TextEncoder().encode(data)
          : new Uint8Array(data);
  
      if (uint8.length < 4) {
        throw new Error("PreimageCodec: not enough data for requester (need 4 bytes)");
      }
  
      // 1) decode `requester`
      const requesterView = new DataView(uint8.buffer, uint8.byteOffset, 4);
      const requester = requesterView.getUint32(0, true);
      const leftover = uint8.slice(4);
  
      // 2) decode the blob with decodeWithBytesUsed(VarLenBytesCodec, leftover)
      const { value: blob, bytesUsed } = decodeWithBytesUsed(
        VarLenBytesCodec,
        leftover
      );
  
     
      // if (4 + bytesUsed !== uint8.length) {
      //   console.warn(`PreimageCodec: leftover bytes after decoding blob`);
      // }
  
      return { requester, blob };
    },
  ] as unknown as Codec<Preimage>;
  

  PreimageCodec.enc = PreimageCodec[0];
  PreimageCodec.dec = PreimageCodec[1];