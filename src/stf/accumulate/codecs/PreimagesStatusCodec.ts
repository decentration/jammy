import { Codec, Bytes, u32 } from "scale-ts";
import { VarLenBytesCodec, toUint8Array, decodeWithBytesUsed, DiscriminatorCodec, concatAll } from "../../../codecs";
import { PreimagesStatusItem } from "../types";

// PreimagesStatusMapEntry ::= SEQUENCE {
//   -- Preimage blob full hash
//   hash OpaqueHash,
//   -- Preimage request status
//   status SEQUENCE (SIZE(0..3)) OF TimeSlot
// }

export const PreimagesStatusItemCodec: Codec<PreimagesStatusItem> = [
  // ENCODER
  (data: PreimagesStatusItem): Uint8Array => {
    const encHash = Bytes(32).enc(data.hash);
  
    const encStatus = DiscriminatorCodec(u32, { maxSize: 3}).enc(data.status);

    return concatAll(encHash, encStatus);
  }
  // DECODER
  , (input: ArrayBuffer | Uint8Array | string): PreimagesStatusItem => {
    const uint8 = toUint8Array(input);
    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    // const blob = read(VarLenBytesCodec);

    const hash = read(Bytes(32));
    const status = read(DiscriminatorCodec(u32, { maxSize: 3}));  
    return { hash, status };
  },
] as unknown as Codec<PreimagesStatusItem>;

PreimagesStatusItemCodec.enc = PreimagesStatusItemCodec[0];
PreimagesStatusItemCodec.dec = PreimagesStatusItemCodec[1];
  
export const PreimagesStatusCodec = DiscriminatorCodec(PreimagesStatusItemCodec);


