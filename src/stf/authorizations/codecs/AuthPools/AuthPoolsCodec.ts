import { Codec } from "scale-ts";
import { AuthPoolCodec } from "./AuthPoolCodec";
import { decodeWithBytesUsed } from "../../../../codecs";
import { toUint8Array, concatAll } from "../../../../codecs";

export const AuthPoolsCodec: Codec<Uint8Array[][]> = [
  // ENCODER
  (pools: Uint8Array[][]): Uint8Array => {
    if (pools.length !== 2) {
      throw new Error(`AuthPools must have length=2, got ${pools.length}`);
    }
    const enc0 = AuthPoolCodec.enc(pools[0]);
    const enc1 = AuthPoolCodec.enc(pools[1]);
    return concatAll(enc0, enc1);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Uint8Array[][] => {
    const uint8 = toUint8Array(data);

    // decode the 1st pool
    const { value: p0, bytesUsed: used0 } = decodeWithBytesUsed(AuthPoolCodec, uint8);
    // slice for 2nd
    const slice1 = uint8.slice(used0);
    const { value: p1, bytesUsed: used1 } = decodeWithBytesUsed(AuthPoolCodec, slice1);

    const offset = used0 + used1;
    if (offset < uint8.length) {
      console.warn(
        `AuthPoolsCodec: leftover data after decoding? offset=${offset}, total=${uint8.length}`
      );
    }
    return [p0, p1];
  },
] as unknown as Codec<Uint8Array[][]>;

AuthPoolsCodec.enc = AuthPoolsCodec[0];
AuthPoolsCodec.dec = AuthPoolsCodec[1];
