import { Codec, u32 } from "scale-ts";
import { ServiceItem } from "../../types";
import { ServiceInfoCodec } from "./ServiceInfoCodec";
import { concatAll, toUint8Array, decodeWithBytesUsed} from "../../../../codecs/utils";

/**
 *   id => 4 bytes (u32)
 *   serviceInfo => from ServiceInfoCodec
 *   items => 4 bytes (u32)
 */
export const ServiceItemCodec: Codec<ServiceItem> = [
  // ENCODER
  (data: ServiceItem): Uint8Array => {
    // id => u32
    const encId = u32.enc(data.id);

    // data => see ServiceInfoCodec
    const encInfo = ServiceInfoCodec.enc(data.data);

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

    const id = Number(read(u32));
    const data = read(ServiceInfoCodec);

    return { id, data };
  },
] as unknown as Codec<ServiceItem>;

ServiceItemCodec.enc = ServiceItemCodec[0];
ServiceItemCodec.dec = ServiceItemCodec[1];
