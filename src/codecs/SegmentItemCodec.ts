import { Codec } from "scale-ts";
import { SegmentItem } from "../types/types";

/**
 * segment_root_lookup item:
 *   - work_package_hash(32 bytes)
 *   - segment_tree_root(32 bytes)
 * total 64 bytes
 */
export const SegmentItemCodec: Codec<SegmentItem> = (() => {
  const encode = (item: SegmentItem): Uint8Array => {
    if (item.work_package_hash.length !== 32) {
      throw new Error("SegmentItemCodec: work_package_hash must be 32 bytes");
    }
    if (item.segment_tree_root.length !== 32) {
      throw new Error("SegmentItemCodec: segment_tree_root must be 32 bytes");
    }
    const out = new Uint8Array(64);
    out.set(item.work_package_hash, 0);
    out.set(item.segment_tree_root, 32);
    return out;
  };

  const decode = (data: ArrayBuffer | Uint8Array | string): SegmentItem => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === "string"
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    if (uint8.length < 64) {
      throw new Error("SegmentItemCodec: not enough data (need 64 bytes)");
    }
    const work_package_hash = uint8.slice(0, 32);
    const segment_tree_root = uint8.slice(32, 64);
    return { work_package_hash, segment_tree_root };
  };

  const c = [encode, decode] as Codec<SegmentItem>;
  c.enc = encode;
  c.dec = decode;
  return c;
})();
