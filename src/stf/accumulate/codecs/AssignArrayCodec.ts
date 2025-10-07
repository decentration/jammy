import { Codec, u32 } from "scale-ts";
import { decodeWithBytesUsed } from "../../../codecs";
import { CORES_COUNT } from "../../../consts";
import { AssignArray } from "../types";

export const AssignArrayCodec: Codec<AssignArray> = [
  // ENCODER
  (arr: AssignArray): Uint8Array => {
    if (arr.length !== CORES_COUNT) {
      throw new Error(`AssignArrayCodec.enc: expected ${CORES_COUNT} items, got ${arr.length}`);
    }
    const encoded = arr.map((sid) => u32.enc(sid));
    const total = encoded.reduce((acc, x) => acc + x.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    for (const buf of encoded) {
      out.set(buf, o);
      o += buf.length;
    }
    return out;
  },
  // DECODER
  (data: ArrayBuffer | Uint8Array | string): AssignArray => {
    const uint8 =
      data instanceof Uint8Array ? data : typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
    const out: number[] = [];
    let offset = 0;
    for (let i = 0; i < CORES_COUNT; i++) {
      const { value, bytesUsed } = decodeWithBytesUsed(u32, uint8.slice(offset));
      out.push(value);
      offset += bytesUsed;
    }

    return out;
  },
] as unknown as Codec<AssignArray>;
AssignArrayCodec.enc = AssignArrayCodec[0];
AssignArrayCodec.dec = AssignArrayCodec[1];