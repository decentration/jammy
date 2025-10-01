import { Codec, Bytes, u64, u32 } from "scale-ts";
import { toUint8Array, concatAll, coerceU64 } from "../../../../codecs/utils";
import { OpaqueHashCodec } from "../../../../types";
import { ServiceInfo } from "../../../types";

// export interface ServiceInfo {
//   code_hash: Uint8Array; // 32 bytes
//   balance: number;       // u64
//   min_item_gas: number;   // u32
//   min_memo_gas: number;   // u32
//   bytes: number;         // u64
//   deposit_offset: number; // u64
//   items: number;      // u32
//   creation_slot: number; // u32
//   last_accumulation_slot: number // u32
//   parent_service: number; // u32
// }

/**
 *  - code_hash = 32 bytes
 *  - balance => 8 bytes (u64)
 *  - min_item_gas => 8 bytes (u64)
 *  - min_memo_gas => 8 bytes (u64)
 *  - bytes => 8 bytes (u64)
 * */
export const ServiceInfoCodec: Codec<ServiceInfo> = [
    // ENCODE
    (service: ServiceInfo): Uint8Array => {

        const encHash = OpaqueHashCodec.enc(service.code_hash);
        const encBalance =       u64.enc(coerceU64(service.balance));
        const encMinItemGas =    u64.enc(coerceU64(service.min_item_gas));
        const encMinMemoGas =    u64.enc(coerceU64(service.min_memo_gas));
        const encBytes =         u64.enc(coerceU64(service.bytes));
        const encDepositOff =    u64.enc(coerceU64(service.deposit_offset));
        const encItems =         u32.enc(service.items);
        const encCreationSlot =  u32.enc(service.creation_slot);
        const encLastAccSlot =   u32.enc(service.last_accumulation_slot);
        const encParentService = u32.enc(service.parent_service);
  
    // concat
    return concatAll(
      encHash, 
      encBalance,
      encMinItemGas, 
      encMinMemoGas, 
      encBytes, 
      encDepositOff,
      encItems,
      encCreationSlot,
      encLastAccSlot,
      encParentService
    );
    },
  
    // DECODE
    (data: ArrayBuffer | Uint8Array | string): ServiceInfo => {
      const u = toUint8Array(data);
      let off = 0;
  
      const read = (n: number) => { const s = u.slice(off, off + n); off += n; return s; };
      const code_hash = Bytes(32).dec(read(32));
  
      const balance                 = u64.dec(read(8));
      const min_item_gas            = u64.dec(read(8));
      const min_memo_gas            = u64.dec(read(8));
      const bytes                   = u64.dec(read(8));
      const deposit_offset          = u64.dec(read(8));
      const items                   = u32.dec(read(4));
      const creation_slot           = u32.dec(read(4));
      const last_accumulation_slot  = u32.dec(read(4));
      const parent_service          = u32.dec(read(4));
     
                
        return {
          code_hash,
          balance,
          min_item_gas,
          min_memo_gas,
          bytes,
          deposit_offset,
          items,
          creation_slot,
          last_accumulation_slot,
          parent_service,
        };
  
    },
  ] as unknown as Codec<ServiceInfo>;
  
  ServiceInfoCodec.enc = ServiceInfoCodec[0];
  ServiceInfoCodec.dec = ServiceInfoCodec[1];