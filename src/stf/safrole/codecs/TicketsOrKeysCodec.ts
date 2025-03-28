import { Codec } from "scale-ts";
import { toUint8Array } from "../../../codecs/utils";
import { TicketBody, TicketBodyCodec } from "../../../codecs/TicketBodyCodec";
import { TicketsOrKeys } from "../types";

/** 
 * Each TicketBody = 33 bytes => 12 tickets => 396 bytes + 1 tag => 397 total
 * Each Key (32 bytes) => 12 => 384 + 1 tag => 385 total
 */
export const TicketsOrKeysCodec: Codec<TicketsOrKeys> = [
  // ENCODER
  (value: TicketsOrKeys): Uint8Array => {
    if ("tickets" in value) {
      // => tickets => tag=0
      const tix = value.tickets;
      if (tix.length !== 12) {
        throw new Error(`TicketsOrKeysCodec: 'tickets' must have exactly 12 items (epoch-length=12).`);
      }
      // 1 byte tag + 12×(33) = 397
      const out = new Uint8Array(1 + 12 * 33);
      out[0] = 0x00; // tickets tag
      let offset = 1;
      for (let i = 0; i < 12; i++) {
        const encItem = TicketBodyCodec.enc(tix[i]); // 33 bytes
        out.set(encItem, offset);
        offset += 33;
      }
      return out;
    } else {
      // => keys => tag=01
      const keys = value.keys;
      if (keys.length !== 12) {
        throw new Error(`TicketsOrKeysCodec: 'keys' must have exactly 12 items (epoch-length=12).`);
      }
      // 1 byte tag + 12×(32) = 385
      const out = new Uint8Array(1 + 12 * 32);
      out[0] = 0x01; // keys tag
      let offset = 1;
      for (let i = 0; i < 12; i++) {
        const key = keys[i];
        if (key.length !== 32) {
          throw new Error(`TicketsOrKeysCodec: key #${i} is not 32 bytes`);
        }
        out.set(key, offset);
        offset += 32;
      }
      return out;
    }
  },

  // DECODER
  (input: ArrayBuffer | Uint8Array | string): TicketsOrKeys => {
    const uint8 = toUint8Array(input);
    if (uint8.length < 1) {
      throw new Error(`TicketsOrKeysCodec: need at least 1 byte for tag, got ${uint8.length}`);
    }

    const tag = uint8[0];
    if (tag === 0x00) {
      // => tickets
      // need at least 1 + 12*33 = 397
      if (uint8.length < 397) {
        throw new Error(
          `TicketsOrKeysCodec(tickets): need at least 397 bytes, got ${uint8.length}`
        );
      }
      // parse 12 items each 33 bytes
      const tickets: TicketBody[] = [];
      let offset = 1;
      for (let i = 0; i < 12; i++) {
        const slice = uint8.slice(offset, offset + 33);
        offset += 33;
        const body = TicketBodyCodec.dec(slice); // a single {id,attempt}
        tickets.push(body);
      }

      // aggregator usage: we only consumed 397
      return { tickets };

    } else if (tag === 0x01) {
      // => keys
      // 1 + 12*32 = 385
      if (uint8.length < 385) {
        throw new Error(
          `TicketsOrKeysCodec(keys): need at least 385 bytes, got ${uint8.length}`
        );
      }
      const keys: Uint8Array[] = [];
      let offset = 1;
      for (let i = 0; i < 12; i++) {
        const keySlice = uint8.slice(offset, offset + 32);
        offset += 32;
        keys.push(keySlice);
      }
      return { keys };
    } else {
      throw new Error(`TicketsOrKeysCodec: invalid tag byte 0x${tag.toString(16)}`);
    }
  },
] as unknown as Codec<TicketsOrKeys>;

TicketsOrKeysCodec.enc = TicketsOrKeysCodec[0];
TicketsOrKeysCodec.dec = TicketsOrKeysCodec[1];
