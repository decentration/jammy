import { Codec } from "scale-ts";
import { concatAll, TICKET_BYTES, TicketBody, TicketBodyCodec, toUint8Array } from "../../../codecs";
import { DiscriminatorCodec } from "../../../codecs/DiscriminatorCodec";
import { EPOCH_LENGTH } from "../../../consts";

export type TicketsMark = TicketBody[];


export const TicketsMarkCodec: Codec<TicketsMark> = [
  // ENCODER
  (items: TicketsMark): Uint8Array => {
    if (items.length !== EPOCH_LENGTH) {
      throw new Error(
        `TicketsMarkCodec.enc: expected ${EPOCH_LENGTH} tickets, got ${items.length}`
      );
    }
    const bufs = items.map(TicketBodyCodec.enc);
    return concatAll(...bufs);
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): TicketsMark => {
    const u = toUint8Array(data);
    const out: TicketBody[] = [];
    let off = 0;

    for (let i = 0; i < EPOCH_LENGTH; i++) {
      if (off + TICKET_BYTES > u.length) {
        throw new Error(
          `TicketsMarkCodec.dec: not enough bytes for ticket #${i} (need ${TICKET_BYTES}, have ${u.length - off})`
        );
      }

      const ticket = TicketBodyCodec.dec(u.subarray(off, off + TICKET_BYTES));
      out.push(ticket);
      off += TICKET_BYTES;
    }

    return out;
  },
] as unknown as Codec<TicketsMark>;

TicketsMarkCodec.enc = TicketsMarkCodec[0];
TicketsMarkCodec.dec = TicketsMarkCodec[1];