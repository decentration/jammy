import { Codec, Bytes, u64, u32 } from "scale-ts";
import { toUint8Array, concatAll } from "../../../../codecs/utils";
import { decodeWithBytesUsed } from "../../../../codecs";
import { ServiceInfo } from "../../types";

/**
 *  - code_hash = 32 bytes
 *  - balance => 8 bytes (u64)
 *  - min_item_gas => 8 bytes (u64)
 *  - min_memo_gas => 8 bytes (u64)
 *  - bytes => 8 bytes (u64)
 * */
export const ServiceInfoCodec: Codec<ServiceInfo> = [
    // ENCODE
    (info: ServiceInfo): Uint8Array => {
        // 1) code_hash => 32 bytes
        const encHash = Bytes(32).enc(info.code_hash);
    
        // 2) balance => u64
        const encBalance = u64.enc(BigInt(info.balance));
    
        // 3) min_item_gas => u64
        const encMinItemGas = u64.enc(BigInt(info.min_item_gas));
    
        // 4) min_memo_gas => u64
        const encMinMemoGas = u64.enc(BigInt(info.min_memo_gas));
    
        // 5) bytes => u64
        const encBytes = u64.enc(BigInt(info.bytes));

        // 6) items => u32
        const encItems = u32.enc(info.items);
  
    // concat
    return concatAll(encHash, encBalance, encMinItemGas, encMinMemoGas, encBytes, encItems);
    },
  
    // DECODE
    (data: ArrayBuffer | Uint8Array | string): ServiceInfo => {
      const uint8 = toUint8Array(data);
      let offset = 0;
  
      // helper to decode a partial chunk
      function read<T>(codec: Codec<T>): T {
        const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
        offset += bytesUsed;
        return value;
      }
  
      // 1) code_hash => 32 bytes
      const code_hash = read(Bytes(32));
  
      // 2) balance => u64 => BigInt => cast to number if safe
      const balanceBI = read(u64);
      const balance = Number(balanceBI); 
  
      // 3) min_item_gas => u64
      const minItemGasBI = read(u64);
      const min_item_gas = Number(minItemGasBI);
  
      // 4) min_memo_gas => u64
      const minMemoGasBI = read(u64);
      const min_memo_gas = Number(minMemoGasBI);
  
      // 5) bytes => u64
      const bytesBI = read(u64);
      const bytesVal = Number(bytesBI);
  
      // 6) items => u64
      const itemsBI = read(u32);
      const items = Number(itemsBI);

      return {
        code_hash,
        balance,
        min_item_gas,
        min_memo_gas,
        bytes: bytesVal,
        items,
      };
    },
  ] as unknown as Codec<ServiceInfo>;
  
  ServiceInfoCodec.enc = ServiceInfoCodec[0];
  ServiceInfoCodec.dec = ServiceInfoCodec[1];