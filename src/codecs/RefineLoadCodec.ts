import { Codec, u64} from "scale-ts";
import { encodeProtocolInt, decodeProtocolInt } from "./IntegerCodec"; 
import { RefineLoad } from "../types"; 
import { concatAll, toUint8Array } from "./utils"; 

export const RefineLoadCodec: Codec<RefineLoad> = [
  // ENCODER 
  (r: RefineLoad): Uint8Array => {
    console.log("RefineLoadCodec: enc", r);

  //   RefineLoad ::= SEQUENCE {
  //     gas-used U64,
  //     imports U16,
  //     extrinsic-count U16,
  //     extrinsic-size U32,
  //     exports U16
  // }


    const encGasUsed        = encodeProtocolInt(r.gas_used);
    const encImports        = encodeProtocolInt(r.imports);
    const encExtrinsicCount = encodeProtocolInt(r.extrinsic_count);
    const encExtrinsicSize  = encodeProtocolInt(r.extrinsic_size);
    const encExports        = encodeProtocolInt(r.exports);

    return concatAll(
      encGasUsed,
      encImports,
      encExtrinsicCount,
      encExtrinsicSize,
      encExports
    );
  },

  // DECODER 
  (data: ArrayBuffer | Uint8Array | string) => {
    const uint8 = toUint8Array(data);
    let offset = 0;

    function readProtocolInt(): number {
      const { value, bytesRead } = decodeProtocolInt(uint8.slice(offset));
      offset += bytesRead;
      return value;
    }

    const gas_used        = readProtocolInt();
    const imports         = readProtocolInt();
    const extrinsic_count = readProtocolInt();
    const extrinsic_size  = readProtocolInt();
    const exports        = readProtocolInt();

    return {
        gas_used,
        imports,
        extrinsic_count,
        extrinsic_size,
        exports, 
    };
  },
] as unknown as Codec<RefineLoad>;

RefineLoadCodec.enc = RefineLoadCodec[0];
RefineLoadCodec.dec = RefineLoadCodec[1];
