import { Codec } from "scale-ts";
import { decodeWithBytesUsed } from "./utils/decodeWithBytesUsed";
import { VarLenBytesCodec } from "./VarLenBytesCodec";
import { ResultValue, TAG } from "../types/types";

// export const ResultValueCodec: Codec<ResultValue> = [
//   // ENCODER
//   (rv: ResultValue) => {
//     if ("ok" in rv) {
//       const encodedOk = VarLenBytesCodec.enc(rv.ok);
//       const rn Uint8Array.of(0x01);
//     } else {

//       return Uint8Array.of(0x02);
//     }
//   },

//   // DECODER
//   (data: ArrayBuffer | Uint8Array | string) => {
//     const uint8 =
//       data instanceof Uint8Array
//         ? data
//         : typeof data === "string"
//         ? new TextEncoder().encode(data)
//         : new Uint8Array(data);

//     if (uint8.length < 1) {
//       throw new Error("ResultValueCodec: no variant byte found");
//     }
//     const variantByte = uint8[0];
//     const remainder = uint8.slice(1);

//     if (variantByte === 0x00) {
//       // "ok" => decode single-byte-len
//       const { value: okBytes } = decodeWithBytesUsed(VarLenBytesCodec, remainder);
//       return { ok: okBytes };
//     } else if (variantByte === 0x01) {
//       return { placeholder: null };
//     } else if (variantByte === 0x02) {
//       return { panic: null };
//     } else {



export const ResultValueCodec: Codec<ResultValue> = [
  // ENCODER
  (rv: ResultValue) => {
    if ("ok" in rv) {
      const enc = VarLenBytesCodec.enc(rv.ok);      // ByteSequence
      const out = new Uint8Array(1 + enc.length);
      out[0] = TAG.ok;
      out.set(enc, 1);
      return out;
    }
    if ("out_of_gas" in rv)   return Uint8Array.of(TAG.out_of_gas);
    if ("panic" in rv)        return Uint8Array.of(TAG.panic);
    if ("bad_exports" in rv)  return Uint8Array.of(TAG.bad_exports);
    if ("bad_code" in rv)     return Uint8Array.of(TAG.bad_code);
    if ("code_oversize" in rv)return Uint8Array.of(TAG.code_oversize);

    throw new Error("ResultValueCodec.enc: unknown variant");
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): ResultValue => {
    const uint8 =
      data instanceof Uint8Array ? data
      : typeof data === "string" ? new TextEncoder().encode(data)
      : new Uint8Array(data);

    if (uint8.length < 1) {
      throw new Error("ResultValueCodec.dec: no discriminator byte");
    }

    const tag = uint8[0];
    const body = uint8.slice(1);

    switch (tag) {
      case TAG.ok: {
        const { value: bytes } = decodeWithBytesUsed(VarLenBytesCodec, body);
        return { ok: bytes };
      }
      case TAG.out_of_gas:   return { out_of_gas: null };
      case TAG.panic:        return { panic: null };
      case TAG.bad_exports:  return { bad_exports: null };
      case TAG.bad_code:     return { bad_code: null };
      case TAG.code_oversize:return { code_oversize: null };
      default:
        throw new Error(`ResultValueCodec.dec: unknown variant byte 0x${tag.toString(32)}`, ); // 
    }
  },
] as unknown as Codec<ResultValue>;

ResultValueCodec.enc = ResultValueCodec[0];
ResultValueCodec.dec = ResultValueCodec[1];