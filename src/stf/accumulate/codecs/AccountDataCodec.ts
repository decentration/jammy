import { Codec } from "scale-ts";
import { VarLenBytesCodec, toUint8Array, decodeWithBytesUsed, DiscriminatorCodec, encodeProtocolInt, decodeProtocolInt, concatAll } from "../../../codecs";
import { AccountData, StorageMap, StorageMapEntry } from "../types";
import { ServiceInfoCodec } from "../../reports/codecs/Services/ServiceInfoCodec";
import { ServiceDataCodec } from "../../reports/codecs/Services/ServiceItemCodec";
import { PreimagesStatusCodec } from "./PreimagesStatusCodec";
import { PreimagesBlobCodec } from "./PreimagesBlobCodec";

// StorageMapEntry ::= SEQUENCE {
//   -- Storage key (unhashed, as managed by the service code)
//   key ByteSequence,
//   -- Storage value
//   value ByteSequence
// }
export const StorageMapEntryCodec: Codec<StorageMapEntry> = [
  // ENCODER
  (entry: StorageMapEntry): Uint8Array => {
    const encKey = VarLenBytesCodec.enc(entry.key);
    const encVal = VarLenBytesCodec.enc(entry.value);
    return concatAll(encKey, encVal);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): StorageMapEntry => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;
    const read = <T,>(codec: Codec<T>): T => {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    };

    const key = read(VarLenBytesCodec);
    const value = read(VarLenBytesCodec);

    return { key, value };
  },
] as unknown as Codec<StorageMapEntry>;
StorageMapEntryCodec.enc = StorageMapEntryCodec[0];
StorageMapEntryCodec.dec = StorageMapEntryCodec[1];


export const AccountDataCodec: Codec<AccountData> = [

// ENCODER
(data: AccountData): Uint8Array => {
console.log("AccountDataCodec: enc", data);
  const encService = ServiceDataCodec.enc(data);
  const encStorage = StorageMapCodec.enc(data.storage);
  const encPreimagesBlob = PreimagesBlobCodec.enc(data.preimages_blob);
  const encPreimagesStatus = PreimagesStatusCodec.enc(data.preimages_status);

  return concatAll(encService, encStorage, encPreimagesBlob, encPreimagesStatus);
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
  const storage = readAndOffset(StorageMapCodec);
  const preimages_blob = readAndOffset(PreimagesBlobCodec);
  const preimages_status = readAndOffset(PreimagesStatusCodec);

  return { service, storage, preimages_blob, preimages_status };

},
] as unknown as Codec<AccountData>;

AccountDataCodec.enc = AccountDataCodec[0];
AccountDataCodec.dec = AccountDataCodec[1];
  
// a discriminator codec for StorageMapEntryCodec
export const StorageMapCodec: Codec<StorageMap> = DiscriminatorCodec<StorageMapEntry>(StorageMapEntryCodec);