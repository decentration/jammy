import { Codec, u32 } from "scale-ts";
import { ServiceInfoCodec } from "./ServiceInfoCodec";
import { concatAll, toUint8Array, decodeWithBytesUsed} from "../../../../codecs/utils";
import { ServiceInfoData, ServiceItem } from "../../../types";

/**
 *   id => 4 bytes (u32)
 *   serviceInfo => from ServiceInfoCodec
 *   items => 4 bytes (u32)
 */
export const ServiceItemCodec: Codec<ServiceItem> = [
  // ENCODER
  (info: ServiceItem): Uint8Array => {
    // id => u32
    const encId = u32.enc(info.id);

    // data => see ServiceInfoCodec
    const encInfo = ServiceDataCodec.enc(info.data);

    return concatAll(encId, encInfo);
  },

  // DECODER
  (input: ArrayBuffer | Uint8Array | string): ServiceItem => {
    const uint8 = toUint8Array(input);
    let offset = 0;

    function read<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    const id = read(u32);
    const data = read(ServiceDataCodec);

    return { id, data };
  },
] as unknown as Codec<ServiceItem>;

ServiceItemCodec.enc = ServiceItemCodec[0];
ServiceItemCodec.dec = ServiceItemCodec[1];


export const ServiceDataCodec: Codec<ServiceInfoData> = [
  // ENCODER
  (data: ServiceInfoData): Uint8Array => {
    const encService = ServiceInfoCodec.enc(data.service);
   return encService;
  },
  // DECODER
  (input: ArrayBuffer | Uint8Array | string): ServiceInfoData => {
    const uint8 = toUint8Array(input);
    let offset = 0;

    function readAndOffset<T>(codec: Codec<T>): T {
      const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
      offset += bytesUsed;
      return value;
    }

    const service = readAndOffset(ServiceInfoCodec);

    return { service };

  }
] as unknown as Codec<ServiceInfoData>;
ServiceDataCodec.enc = ServiceDataCodec[0];
ServiceDataCodec.dec = ServiceDataCodec[1];