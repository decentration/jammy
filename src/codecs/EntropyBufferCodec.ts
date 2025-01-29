import { Codec } from "scale-ts";
import { toUint8Array } from "./utils"; 

/** We expect exactly 1 => 4 x 32 bytes = 128 bytes total. */
export const EntropyBufferCodec: Codec<Uint8Array[]> = [
  // ENCODER
  (items: Uint8Array[]): Uint8Array => {
    console.log("EntropyBufferCodec items", items);
    if (items.length !== 4) {
      throw new Error(`EntropyBuffer must have exactly 4 items, got ${items.length}`);
    }
    // Each item is 32 bytes
    const out = new Uint8Array(4 * 32);
    let offset = 0;
    for (const ent of items) {
      console.log("EntropyBufferCodec ent", ent);
      if (ent.length !== 32) {
        throw new Error(`Entropy item is not 32 bytes is ${ent.length}`);
      }
      out.set(ent, offset);
      offset += 32;
    }
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Uint8Array[] => {
    const uint8 = toUint8Array(data);
    if (uint8.length !== 128) {
      console.warn(`EntropyBuffer: expected 128 bytes, got ${uint8.length}`);
    }
    const items: Uint8Array[] = [];
    let offset = 0;
    for (let i = 0; i < 4; i++) {
      const chunk = uint8.slice(offset, offset + 32);
      offset += 32;
      items.push(chunk);
    }
    return items;
  },
] as unknown as Codec<Uint8Array[]>;

EntropyBufferCodec.enc = EntropyBufferCodec[0];
EntropyBufferCodec.dec = EntropyBufferCodec[1];
