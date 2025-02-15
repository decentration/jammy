import { createCodec, Codec } from "scale-ts";
import { encodeProtocolInt, decodeProtocolInt } from "./IntegerCodec";

export const VarLenBytesCodec: Codec<Uint8Array> = createCodec(
  (value: Uint8Array) => {
    // console.log("about to encoded value.length", value.length); 
    // 1) encode length
    const lenEncoded = encodeProtocolInt(value.length);
    // 2) concat
    const out = new Uint8Array(lenEncoded.length + value.length);
    out.set(lenEncoded, 0);
    out.set(value, lenEncoded.length);
    return out;
  },
  (data: Uint8Array | ArrayBuffer | string) => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    // 1) decode length
    const { value: length, bytesRead } = decodeProtocolInt(uint8);
    if (uint8.length < bytesRead + length) {
      throw new Error(`VarLenBytesCodec: not enough bytes for data; length=${length}, got=${uint8.length - bytesRead}`);
    }
    // 2) slice out the data
    const bytes = uint8.slice(bytesRead, bytesRead + length);
    return bytes;
  }
);
