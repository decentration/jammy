import { blake2b } from "blakejs";

export const hash = (data: Uint8Array, key: any = undefined, outLen: number = 32): Uint8Array => blake2b(data, key, outLen);  