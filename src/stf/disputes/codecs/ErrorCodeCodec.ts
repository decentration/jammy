import { Codec } from "scale-ts";
import { ErrorCode } from "../types";
import { VarLenBytesCodec } from "../../../codecs";
import { decodeWithBytesUsed, toUint8Array } from "../../../codecs";

export const ErrorCodeCodec: Codec<ErrorCode> = [
  // ENCODER
  (ec: ErrorCode): Uint8Array => {
    const textBytes = new TextEncoder().encode(ec); 
    return VarLenBytesCodec.enc(textBytes);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): ErrorCode => {
    const uint8 = toUint8Array(data);
    const { value: textBytes, bytesUsed } = decodeWithBytesUsed(VarLenBytesCodec, uint8);
    const text = new TextDecoder().decode(textBytes);
    return text as ErrorCode;
  },
] as unknown as Codec<ErrorCode>;

ErrorCodeCodec.enc = ErrorCodeCodec[0];
ErrorCodeCodec.dec = ErrorCodeCodec[1];
