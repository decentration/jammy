import { Codec } from "scale-ts";
import { toUint8Array, concatAll } from "./utils";

/**
 * TicketBody = { id(32 bytes), attempt(1 byte) }
 */
export interface TicketBody {
  id: Uint8Array;
  attempt: number;
}

export const TicketBodyCodec: Codec<TicketBody> = [
  // ENCODER
  (tb: TicketBody): Uint8Array => {
    if (tb.id.length !== 32) {
      throw new Error(`TicketBodyCodec: ID must be 32 bytes`);
    }
    // attempt is 1 byte
    const out = new Uint8Array(33);
    out.set(tb.id, 0);
    out[32] = tb.attempt & 0xff;
    return out;
  },
  // DECODER
  (data: ArrayBuffer | Uint8Array | string): TicketBody => {
    const uint8 = toUint8Array(data);
   // Check total size
   if (uint8.length < 33) {
    throw new Error(`TicketBodyCodec: expected >=33 bytes, got ${uint8.length}`);
  }

  let offset = 0;

  const id = uint8.slice(offset, offset + 32);
  offset += 32;

  const attempt = uint8[offset];
  offset += 1;

  if (offset < uint8.length) {
    console.warn(`TicketBodyCodec leftover bytes: offset=${offset}, total=${uint8.length}`);
  }
    return { id, attempt };
  },
] as unknown as Codec<TicketBody>;

TicketBodyCodec.enc = TicketBodyCodec[0];
TicketBodyCodec.dec = TicketBodyCodec[1];
