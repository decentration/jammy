import { Codec } from "scale-ts";
import { decodeWithBytesUsed, DiscriminatorCodec } from "./index";
import { Bytes, u32 } from "scale-ts";
import { Context } from "../types/types";

export const ContextCodec: Codec<Context> = [
  // ENCODER
  (ctx: Context): Uint8Array => {
    // anchor(32), state_root(32), beefy_root(32), lookup_anchor(32)
    const out = new Uint8Array(32 + 32 + 32 + 32 + 4);
    let offset = 0;

    out.set(ctx.anchor, offset);
    offset += 32;
    out.set(ctx.state_root, offset);
    offset += 32;
    out.set(ctx.beefy_root, offset);
    offset += 32;
    out.set(ctx.lookup_anchor, offset);
    offset += 32;

    // slot => 4 bytes
    const dv = new DataView(out.buffer, offset, 4);
    dv.setUint32(0, ctx.lookup_anchor_slot, true);
    offset += 4;

    const encPre = DiscriminatorCodec(Bytes(32)).enc(ctx.prerequisites);
    const combined = new Uint8Array(out.length + encPre.length);
    combined.set(out, 0);
    combined.set(encPre, out.length);

    return combined;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): Context => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    let offset = 0;
    if (uint8.length < 32 + 32 + 32 + 32 + 4) {
      throw new Error(`ContextCodec: not enough data for anchor/roots/slot`);
    }

    const anchor = uint8.slice(offset, offset + 32);
    offset += 32;
    const state_root = uint8.slice(offset, offset + 32);
    offset += 32;
    const beefy_root = uint8.slice(offset, offset + 32);
    offset += 32;
    const lookup_anchor = uint8.slice(offset, offset + 32);
    offset += 32;

    const dv = new DataView(uint8.buffer, uint8.byteOffset + offset, 4);
    const lookup_anchor_slot = dv.getUint32(0, true);
    offset += 4;

    // decode the prerequisites from the remainder
    const slice = uint8.slice(offset);
    const { value: prerequisites, bytesUsed } = decodeWithBytesUsed(
      DiscriminatorCodec(Bytes(32)),
      slice
    );
    offset += bytesUsed;

    return {
      anchor,
      state_root,
      beefy_root,
      lookup_anchor,
      lookup_anchor_slot,
      prerequisites,
    };
  },
] as Codec<Context>;

ContextCodec.enc = ContextCodec[0];
ContextCodec.dec = ContextCodec[1];
