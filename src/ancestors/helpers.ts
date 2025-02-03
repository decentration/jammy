import { toHex } from "../utils";


// foro speed of search we use a string key
export function ancestorKey(slot: number, hash: Uint8Array): string {
  return `${slot}-${toHex(hash)}`;
}