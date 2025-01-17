import { Codec } from "scale-ts";
import { Bytes, u8 } from "scale-ts";
import { TicketsMark } from "../types/types";

export const SingleTicketsMarkCodec: Codec<TicketsMark> = [
  // ENCODER
  (ticket: TicketsMark): Uint8Array => {
    const out = new Uint8Array(33);
    out.set(ticket.id, 0);
    out[32] = ticket.attempt & 0xff;
    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): TicketsMark => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length !== 33) {
      throw new Error(`SingleTicketsMarkCodec: expected 33 bytes, got ${uint8.length}`);
    }

    const id = uint8.slice(0, 32);
    const attempt = uint8[32];
    return { id, attempt };
  },
] as unknown as Codec<TicketsMark>;

SingleTicketsMarkCodec.enc = SingleTicketsMarkCodec[0];
SingleTicketsMarkCodec.dec = SingleTicketsMarkCodec[1];