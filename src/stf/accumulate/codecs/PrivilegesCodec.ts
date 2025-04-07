import { Codec, u32 } from "scale-ts";
import { concatAll, decodeProtocolInt, decodeWithBytesUsed, DiscriminatorCodec, encodeProtocolInt } from "../../../codecs";
import { AlwaysAccumulateMapEntry, Privileges } from "../types";


 const AlwaysAccumulateMapEntryCodec: Codec<AlwaysAccumulateMapEntry> = [
  // ENCODER
  (entry: AlwaysAccumulateMapEntry): Uint8Array => {
 
    const encId = u32.enc(entry.id);
    const encGas = encodeProtocolInt(entry.gas);

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

    const { value: gas, bytesRead: gasUsed } = decodeProtocolInt(uint8.slice(offset));
    offset += gasUsed;
  

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
    const encAssign = u32.enc(privilege.assign);
    const encDesignate = u32.enc(privilege.designate);
    const encAlwaysAcc = DiscriminatorCodec(AlwaysAccumulateMapEntryCodec).enc(privilege.always_acc);

    return concatAll(encBless, encAssign, encDesignate, encAlwaysAcc);
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
    const assign = read(u32);
    const designate = read(u32);
    const always_acc = read(DiscriminatorCodec(AlwaysAccumulateMapEntryCodec));

    return {
      bless,
      assign,
      designate,
      always_acc,
    };
  },
] as unknown as Codec<Privileges>;

PrivilegesCodec.enc = PrivilegesCodec[0];
PrivilegesCodec.dec = PrivilegesCodec[1];


