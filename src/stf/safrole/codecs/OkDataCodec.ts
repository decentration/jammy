import { Codec } from "scale-ts";
import { OkData } from "../types";
import { decodeWithBytesUsed } from "../../../codecs";
import { EpochMarkCodec } from "../../../codecs/EpochMarkCodec";
import { TicketsAccumulatorCodec } from "./TicketsAccumulatorCodec";

// the OkData shape: { epoch_mark: EpochMark|null, tickets_mark: TicketsMark[]|null }

export const OkDataCodec: Codec<OkData> = [
  // ENCODER
  (okData: OkData): Uint8Array => {
    // 1) epoch_mark => presence byte
    let epochTag: Uint8Array;
    let epochMarkEnc: Uint8Array;
    if (okData.epoch_mark === null) {
      epochTag = new Uint8Array([0x00]);
      epochMarkEnc = new Uint8Array();
    } else {
      epochTag = new Uint8Array([0x01]);
      epochMarkEnc = EpochMarkCodec.enc(okData.epoch_mark);
    }

    // 2) tickets_mark => presence byte
    let ticketsTag: Uint8Array;
    let ticketsEnc: Uint8Array;
    if (okData.tickets_mark === null) {
      ticketsTag = new Uint8Array([0x00]);
      ticketsEnc = new Uint8Array();
    } else {
      ticketsTag = new Uint8Array([0x01]);
      ticketsEnc = TicketsAccumulatorCodec.enc(okData.tickets_mark);
    }

    // Combine
    const out = new Uint8Array(
      1 + epochMarkEnc.length + 1 + ticketsEnc.length
    );
    out.set(epochTag, 0);
    out.set(epochMarkEnc, 1);

    const offset2 = 1 + epochMarkEnc.length;
    out.set(ticketsTag, offset2);
    out.set(ticketsEnc, offset2 + 1);

    return out;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): OkData => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;

    // 1) epoch_mark => presence
    if (offset >= uint8.length) {
      throw new Error("OkDataCodec: no data left for epoch_mark presence byte");
    }
    const epochByte = uint8[offset++];
    let epoch_mark = null;
    if (epochByte === 0x01) {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(EpochMarkCodec, slice);
      epoch_mark = value;
      offset += bytesUsed;
    } else if (epochByte !== 0x00) {
      throw new Error(`OkDataCodec: invalid presence byte for epoch_mark=0x${epochByte.toString(16)}`);
    }

    // 2) tickets_mark => presence
    if (offset >= uint8.length) {
      // If data ended, tickets_mark is null
      return { epoch_mark, tickets_mark: null };
    }
    const ticketsByte = uint8[offset++];
    let tickets_mark = null;
    if (ticketsByte === 0x01) {
      const slice = uint8.slice(offset);
      const { value, bytesUsed } = decodeWithBytesUsed(TicketsAccumulatorCodec, slice);
      tickets_mark = value;
      offset += bytesUsed;
    } else if (ticketsByte !== 0x00) {
      throw new Error(`OkDataCodec: invalid presence byte for tickets_mark=0x${ticketsByte.toString(16)}`);
    }

    return { epoch_mark, tickets_mark };
  },
] as unknown as Codec<OkData>;

OkDataCodec.enc = OkDataCodec[0];
OkDataCodec.dec = OkDataCodec[1];
