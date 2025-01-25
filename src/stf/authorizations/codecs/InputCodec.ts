import { Codec } from "scale-ts";
import { AuthorizationsInput, CoreAuthorizer } from "../types";
import { toUint8Array, concatAll } from "../../../codecs/utils";
import { CoreAuthorizerCodec } from "../types";

export const InputCodec: Codec<AuthorizationsInput> = [
  // ENCODER
  (input: AuthorizationsInput): Uint8Array => {
    // 1) slot => 4 bytes LE
    const slotBuf = new Uint8Array(4);
    new DataView(slotBuf.buffer).setUint32(0, input.slot, true);

    // 2) length prefix (u8) for auths
    if (input.auths.length > 255) {
      throw new Error(`Too many core authorizers for a single u8 prefix`);
    }
    const lengthByte = new Uint8Array([input.auths.length]);

    // 3) encode each coreAuthorizer
    const encodedAuths = input.auths.map((auth) => CoreAuthorizerCodec.enc(auth));

    return concatAll(slotBuf, lengthByte, ...encodedAuths);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AuthorizationsInput => {
    const uint8 = toUint8Array(data);
    if (uint8.length < 5) {
      throw new Error(
        `AuthorizationsInput decode: not enough data (need at least 5 bytes: 4 for slot + 1 for length)`
      );
    }

    // 1) read slot
    let offset = 0;
    const slot = new DataView(uint8.buffer, uint8.byteOffset + offset, 4).getUint32(0, true);
    offset += 4;

    // 2) read lengthByte
    const authsCount = uint8[offset];
    offset += 1;

    // 3) read each coreAuthorizer (34 bytes each)
    const auths: CoreAuthorizer[] = [];
    for (let i = 0; i < authsCount; i++) {
      if (offset + 34 > uint8.length) {
        throw new Error(`Not enough data for coreAuthorizer #${i}`);
      }
      const slice = uint8.slice(offset, offset + 34);
      offset += 34;
      auths.push(CoreAuthorizerCodec.dec(slice));
    }

    return { slot, auths };
  },
] as unknown as Codec<AuthorizationsInput>;

InputCodec.enc = InputCodec[0];
InputCodec.dec = InputCodec[1];
