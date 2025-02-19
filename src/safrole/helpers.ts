import { toUint8Array } from "../codecs";
import { blake2b } from "blakejs";

export function blake2bConcat(x: Uint8Array | string, y: Uint8Array | string): Uint8Array {

  // clean inputs
  if (typeof x === "string") x = toUint8Array(x);
  if (typeof y === "string") y = toUint8Array(y);

  console.log("x", x);
  console.log("y", y);
  
  const combined = new Uint8Array(x.length + y.length);
  combined.set(x, 0);
  combined.set(y, x.length);
  console.log("combined", combined);

  return blake2b(combined, undefined, 32);
}