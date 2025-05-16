import { Codec, Bytes, u32, u64 } from "scale-ts";
import { VarLenBytesCodec, toUint8Array, decodeWithBytesUsed, DiscriminatorCodec, encodeProtocolInt, decodeProtocolInt, concatAll } from "../../../codecs";
import { AccountData, PreimageItem, ServiceInfo } from "../types";
import { convertToReadableFormat } from "../../../utils";

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
  

  export const ServiceCodec: Codec<ServiceInfo> = [
    // ENCODER
    (data: ServiceInfo): Uint8Array => {
      const encCodeHash = Bytes(32).enc(data.code_hash);
      const encBalance = u64.enc(BigInt(data.balance)); // u64 compact
      const encMinItemGas = u64.enc(BigInt(data.min_item_gas));
      const encMinMemoGas = u64.enc(BigInt(data.min_memo_gas));
      const encBytes = u64.enc(BigInt(data.bytes));
      const encItems = u32.enc(data.items);
  const concated = concatAll(encCodeHash, encBalance, encMinItemGas, encMinMemoGas, encBytes, encItems);
      console.log("ServiceCodec: enc", convertToReadableFormat(concated));
      return concatAll(
        encCodeHash,
        encBalance,
        encMinItemGas,
        encMinMemoGas,
        encBytes,
        encItems
      );
    }
    // DECODER 
    , (input: ArrayBuffer | Uint8Array | string): ServiceInfo => {
      const uint8 = toUint8Array(input);
      let offset = 0;
  
      function read<T>(codec: Codec<T>): T {
        const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
        offset += bytesUsed;
        return value;
      }
  
      const code_hash = read(Bytes(32));
      const balance = Number(read(u64));
      const min_item_gas =Number(read(u64));
      const min_memo_gas = Number(read(u64));
      const bytes = Number(read(u64));
      const items = read(u32);
  
      return { code_hash, balance: balance, min_item_gas, min_memo_gas, bytes, items };
    },
  ] as unknown as Codec<ServiceInfo>;
  ServiceCodec.enc = ServiceCodec[0];
  ServiceCodec.dec = ServiceCodec[1];


export const AccountDataCodec: Codec<AccountData> = [

    // ENCODER
    (data: AccountData): Uint8Array => {
    console.log("AccountDataCodec: enc", data);
      const encService = ServiceCodec.enc(data.service);
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
  
      const service = readAndOffset(ServiceCodec);
      const preimages = readAndOffset(PreimagesCodec);
  
      return { service, preimages };
  
    },
  ] as unknown as Codec<AccountData>;

  AccountDataCodec.enc = AccountDataCodec[0];
  AccountDataCodec.dec = AccountDataCodec[1];
  