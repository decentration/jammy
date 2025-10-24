import { coerceU64 } from "../codecs";

export const toGas = (x: number | string | bigint): bigint => coerceU64(x);
export const addGas = (a: number | string | bigint, b: number | string | bigint): bigint =>
  toGas(a) + toGas(b);

export const addU64 = (a: number | string | bigint, b: number | string | bigint) =>
    coerceU64(a) + coerceU64(b);
  
// length of an “ok” result payload in bytes
export function okLen(ok: Uint8Array | string): number {
if (typeof ok === "string") {
    const s = ok.startsWith("0x") ? ok.slice(2) : ok;
    return s.length >>> 1;
}
return ok.length;
}