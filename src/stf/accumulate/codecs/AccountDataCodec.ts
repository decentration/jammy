import { Codec, Bytes, u32, u64 } from "scale-ts";
import { VarLenBytesCodec, toUint8Array, decodeWithBytesUsed, DiscriminatorCodec, encodeProtocolInt, decodeProtocolInt, concatAll } from "../../../codecs";
import { AccountData, PreimageItem } from "../types";
import { ServiceInfoCodec } from "../../reports/codecs/Services/ServiceInfoCodec";
import { ServiceDataCodec } from "../../reports/codecs/Services/ServiceItemCodec";

// export interface PreimageItem {
//     hash: OpaqueHash, // 32 bytes
//     blob: Uint8Array, // many bytes nt a number


// } 
export const PreimageItemCodec: Codec<PreimageItem> = [
  // ENCODER
  (data: PreimageItem): Uint8Array => {
    const encHash = Bytes(32).enc(data.hash);
    const encBlob = VarLenBytesCodec.enc(data.blob);

    return concatAll(encHash, encBlob);
  }
  // DECODER
  , (input: ArrayBuffer | Uint8Array | string): PreimageItem => {
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
] as unknown as Codec<PreimageItem>;

PreimageItemCodec.enc = PreimageItemCodec[0];
PreimageItemCodec.dec = PreimageItemCodec[1];
  
export const PreimagesCodec = DiscriminatorCodec(PreimageItemCodec);



export const AccountDataCodec: Codec<AccountData> = [

// ENCODER
(data: AccountData): Uint8Array => {
console.log("AccountDataCodec: enc", data);
  const encService = ServiceDataCodec.enc(data);
  const encPreimages = PreimagesCodec.enc(data.preimages);

  return concatAll(encService, encPreimages);
},

// DECODER
(input: ArrayBuffer | Uint8Array | string): AccountData => {
  const uint8 = toUint8Array(input);
  let offset = 0;

  function readAndOffset<T>(codec: Codec<T>): T {
    const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
    offset += bytesUsed;
    return value;
  }

  const service = readAndOffset(ServiceInfoCodec);
  const preimages = readAndOffset(PreimagesCodec);

  return { service, preimages };

},
] as unknown as Codec<AccountData>;

AccountDataCodec.enc = AccountDataCodec[0];
AccountDataCodec.dec = AccountDataCodec[1];
  