// src/codecs/TicketsMarkCodec.ts
import { Codec } from "scale-ts";
import { toUint8Array, concatAll } from "../codecs/utils";
import type { TicketsMark } from "../types/types";

export const TicketsMarkCodec: Codec<TicketsMark[]> = [
  // ENCODER
  (tickets: TicketsMark[]): Uint8Array => {
    // We expect exactly 12 items
    if (tickets.length !== 12) {
      throw new Error(`TicketsMarkCodec: must have exactly 12 TicketsMark items`);
    }
    // Each item is 33 bytes => total = 396
    const out = new Uint8Array(12 * 33);
    let offset = 0;
    for (let i = 0; i < 12; i++) {
      const tm = tickets[i];
      if (tm.id.length !== 32) {
        throw new Error(`TicketsMarkCodec: item #${i} => id must be 32 bytes`);
      }
      // copy ID(32)
      out.set(tm.id, offset);
      offset += 32;
      // copy attempt(1)
      out[offset] = tm.attempt & 0xff;
      offset += 1;
    }
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): TicketsMark[] => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 12 * 33) {
      throw new Error(
        `TicketsMarkCodec: not enough data for 12 items => need 396, got ${uint8.length}`
      );
    }
    const out: TicketsMark[] = [];
    let offset = 0;
    for (let i = 0; i < 12; i++) {
      const id = uint8.slice(offset, offset + 32);
      offset += 32;
      const attempt = uint8[offset++];
      out.push({ id, attempt });
    }
    // We consumed exactly 396
    // If aggregator gave us more => partial consumption approach
    return out;
  },
] as unknown as Codec<TicketsMark[]>;

TicketsMarkCodec.enc = TicketsMarkCodec[0];
TicketsMarkCodec.dec = TicketsMarkCodec[1];


export type { TicketsMark } from "../types/types";