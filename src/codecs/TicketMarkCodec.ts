import { Codec } from "scale-ts";
import { Bytes, u8, u16 } from "scale-ts";
import { TicketMark } from "../types/types";

export const TicketMarkCodec: Codec<TicketMark> = [
  // Encoder
  (tm: TicketMark): Uint8Array => {
    const encId = Bytes(32).enc(tm.id);
    const encAttempt = u8.enc(tm.attempt);

    const out = new Uint8Array(33);
    out.set(encId, 0);
    out.set(encAttempt, 32);

    return out;
  },

  // Decoder
  (data: Uint8Array | ArrayBuffer | string): { tickets: TicketMark[]; remainingData: Uint8Array; } => {
    const uint8 = data instanceof Uint8Array
      ? data
      : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    const tickets: TicketMark[] = [];
    let offset = 0;

    while (offset + 33 <= uint8.length) {
      // Check for stop condition (00 followed by valid u16)
      if (uint8[offset] === 0x00 && offset + 3 <= uint8.length) {
        const potentialStop = new DataView(uint8.buffer, uint8.byteOffset + offset, 3);
        const u16Value = potentialStop.getUint16(1, true); // Little-endian u16

        if (u16Value > 0) break;
      }

      // Decode the current ticket
      const id = uint8.slice(offset, offset + 32);
      const attempt = uint8[offset + 32];
      tickets.push({ id, attempt });

      offset += 33;
    }

    // Remaining data starts after the tickets
    const remainingData = uint8.slice(offset);

    return { tickets, remainingData };
  },
] as unknown as Codec<TicketMark>;

TicketMarkCodec.enc = TicketMarkCodec[0];
TicketMarkCodec.dec = TicketMarkCodec[1];
