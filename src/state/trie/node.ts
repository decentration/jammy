import { concatAll } from "../../codecs";
import { hash } from "../../utils/crypto";

// node encoders
export const encodeBranch = (l: Uint8Array, r: Uint8Array): Uint8Array => {
  if (l.length !== 32 || r.length !== 32) throw new Error("branch args");
  const head = l[0] &  0b11111110;                         // clear LSB by bitwise AND with 0b11111110
  return concatAll(new Uint8Array([head]), l.slice(1), r); // 64 Bytes
};

export const encodeLeaf = (key: Uint8Array, value: Uint8Array): Uint8Array => {
  if (key.length !== 32)  throw new Error("key len");
  if (value.length <= 32) {                            // if <= than 32 bytes, embed value in leaf

    // in byte 1 we store the length of the value in bits 2-7 and the bit0 and bit1 is a flag set to 01
    const head = (value.length << 2) | 0b01;           // shift length 2 bits to left, and add 01 in the empty space as a flag 
    const pad = new Uint8Array(32 - value.length);
    return concatAll(new Uint8Array([head]), key.slice(0, 31), value, pad);
  }
  
  // else if value is too long we use the regular way, 
  // we will store the hash of the value - store H(value)
  const head = 0b11;
  return concatAll(new Uint8Array([head]), key.slice(0, 31), hash(value));
};