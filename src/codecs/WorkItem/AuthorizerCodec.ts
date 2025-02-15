import { Codec } from "scale-ts";
import { Authorizer } from "../../types/types";
import { Bytes } from "scale-ts";
import { VarLenBytesCodec, decodeWithBytesUsed } from "../index";

export const AuthorizerCodec: Codec<Authorizer> = [
  // ENCODER
  (auth: Authorizer): Uint8Array => {
    // code_hash => 32 bytes
    // params => VarLenBytesCodec
    const codeHashBytes = Bytes(32).enc(auth.code_hash);
    const paramsBytes = VarLenBytesCodec.enc(auth.params);

    const out = new Uint8Array(codeHashBytes.length + paramsBytes.length);
    out.set(codeHashBytes, 0);
    out.set(paramsBytes, codeHashBytes.length);
    return out;
  },
  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Authorizer => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    // 1) code_hash => 32 bytes
    if (uint8.length < 32) {
      throw new Error("AuthorizerCodec: not enough data for code_hash (need 32 bytes)");
    }
    const code_hash = uint8.slice(0, 32);

    // 2) decode params => VarLenBytesCodec
    const remainder = uint8.slice(32);
    const { value: params, bytesUsed } = decodeWithBytesUsed(
      VarLenBytesCodec,
      remainder
    );

    return {
      code_hash,
      params,
    };
  },
] as Codec<Authorizer>;

AuthorizerCodec.enc = AuthorizerCodec[0];
AuthorizerCodec.dec = AuthorizerCodec[1];
