import { Codec, u32, u64 } from "scale-ts";
import { coerceU64, concatAll, decodeProtocolInt, decodeWithBytesUsed, DiscriminatorCodec, encodeProtocolInt } from "../../../codecs";
import { AlwaysAccumulateMapEntry, Privileges } from "../types";
import { decodeProtocolIntBig } from "../../../codecs/IntegerCodec2";
import { AssignArrayCodec } from "./AssignArrayCodec";


 const AlwaysAccumulateMapEntryCodec: Codec<AlwaysAccumulateMapEntry> = [
  // ENCODER
  (entry: AlwaysAccumulateMapEntry): Uint8Array => {
 
    const encId = u32.enc(entry.id);
    const encGas = u64.enc(coerceU64(entry.gas));

    return concatAll(encId, encGas);
  },
  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AlwaysAccumulateMapEntry => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    const id = read(u32);
    const gas = read(u64);
  

    return {
      id,
      gas,
    };
  },
] as unknown as Codec<AlwaysAccumulateMapEntry>;
AlwaysAccumulateMapEntryCodec.enc = AlwaysAccumulateMapEntryCodec[0];
AlwaysAccumulateMapEntryCodec.dec = AlwaysAccumulateMapEntryCodec[1];


 export const PrivilegesCodec: Codec<Privileges> = [
  // ENCODER
  (privilege: Privileges): Uint8Array => {
 
    const encBless = u32.enc(privilege.bless);
    const encAssign = AssignArrayCodec.enc(privilege.assign);    
    const encDesignate = u32.enc(privilege.designate);
    const encRegister = u32.enc(privilege.register);
    const encAlwaysAcc = DiscriminatorCodec(AlwaysAccumulateMapEntryCodec).enc(privilege.always_acc);

    return concatAll(encBless, encAssign, encDesignate, encRegister, encAlwaysAcc);
  },
  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Privileges => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    const bless = read(u32);
    const assign = read(AssignArrayCodec);
    const designate = read(u32);
    const register = read(u32);
    const always_acc = read(DiscriminatorCodec(AlwaysAccumulateMapEntryCodec));

    return {
      bless,
      assign,
      designate,
      register,
      always_acc,
    };
  },
] as unknown as Codec<Privileges>;

PrivilegesCodec.enc = PrivilegesCodec[0];
PrivilegesCodec.dec = PrivilegesCodec[1];


