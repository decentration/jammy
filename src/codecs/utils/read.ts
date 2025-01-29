import { Codec } from "scale-ts";
import { decodeWithBytesUsed } from "./decodeWithBytesUsed";

export function read<T>(codec: Codec<T>, offset: number): { value: T; offset: number } {
    const uint8 = new Uint8Array(); 
    const { value, bytesUsed } = decodeWithBytesUsed(codec, uint8.slice(offset));
    offset += bytesUsed;
    return { value, offset };
  }
  