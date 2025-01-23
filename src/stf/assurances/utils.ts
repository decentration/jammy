export function scaleEncodeAnchorBitfield(
    anchor: Uint8Array,
    bitfield: Uint8Array
  ): Uint8Array {
    const out = new Uint8Array(anchor.length + bitfield.length);
    out.set(anchor, 0);
    out.set(bitfield, anchor.length);
    return out;
  }
  