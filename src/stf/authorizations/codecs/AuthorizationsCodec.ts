import { Codec } from "scale-ts";
import { Authorizations } from "../types";
import { InputCodec } from "./InputCodec";
import { StateCodec } from "./StateCodec";
import { OutputCodec } from "./OutputCodec";
import { decodeWithBytesUsed } from "../../../codecs"; 
import { toUint8Array, concatAll } from "../../../codecs";


export const AuthorizationsCodec: Codec<Authorizations> = [
  // ENCODER
  (authz: Authorizations): Uint8Array => {
    const encInput = InputCodec.enc(authz.input);
    const encPre = StateCodec.enc(authz.pre_state);
    // output is null => no bytes
    const encPost = StateCodec.enc(authz.post_state);
    return concatAll(encInput, encPre, encPost);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Authorizations => {
    const uint8 = toUint8Array(data);

    let offset = 0;

    // 1) input
    {
      const { value, bytesUsed } = decodeWithBytesUsed(InputCodec, uint8.slice(offset));
      offset += bytesUsed;
      var input = value;
    }

    // 2) pre_state
    {
      const { value, bytesUsed } = decodeWithBytesUsed(StateCodec, uint8.slice(offset));
      offset += bytesUsed;
      var pre_state = value;
    }

    // 3) post_state
    {
      const { value, bytesUsed } = decodeWithBytesUsed(StateCodec, uint8.slice(offset));
      offset += bytesUsed;
      var post_state = value;
    }

    if (offset < uint8.length) {
      console.warn(
        `AuthorizationsCodec: leftover data? offset=${offset}, total=${uint8.length}`
      );
    }

    return {
      input,
      pre_state,
      output: null, // no bytes
      post_state,
    };
  },
] as unknown as Codec<Authorizations>;

AuthorizationsCodec.enc = AuthorizationsCodec[0];
AuthorizationsCodec.dec = AuthorizationsCodec[1];
