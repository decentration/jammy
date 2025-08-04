import { u32, u64 } from "scale-ts";
import { toLE } from "../instructions/helpers";
import { InterpreterState } from "../types";
import { INFO_BYTES } from "./consts";
import { EncodableAccount, FetchVector, ServiceAccount } from "./types";


// ΩY fetch vector selector map 
// This is a lookup table thats turns the value in register[10] into which blob the fetch function should return 
export const fetchVecSelectorMap: Record<number, FetchVector | undefined> = {
    0: "codeBlob",        // c
    1: "paramBlob",       // n
    2: "returnBlob",      // r
    // 3‑6: imports / work‑items variants (x / i)
    3: "imports", 4: "workItems", 5: "imports", 6: "imports",
    // 7‑13: program‑blob sub‑vectors (p...)
    7: "paramBlob", 8: "paramBlob", 9: "paramBlob",
    10: "paramBlob", 11: "paramBlob", 12: "paramBlob", 13: "paramBlob",
    // 14‑15: authoriser trace (o)
    14: "authoriserTrace", 15: "authoriserTrace",
    // 16‑17: transfer list (t)
    16: "transferList", 17: "transferList"
};

export function finish(s: InterpreterState, c: bigint) { 
    return { 
        state: { ...s, registers: Object.assign([], s.registers, { 7: c }) }, 
        ok: true 
    };
}


// B.6 (info general function) -->  (m) --> E(tc,tb,tt,tg,tm,to,ti) encoder
export function encodeInfoHelper(sa: EncodableAccount): Uint8Array {
  const out = new Uint8Array(INFO_BYTES);
  let p = 0;

  // tc — 32-byte root code-hash
  const tc = sa.rootCodeHash > 0n
    ? ((): Uint8Array => {
        const b = new Uint8Array(32);
        // rootCodeHash is a 256-bit bigint; write 32 little-endian bytes
        for (let i = 0; i < 32; i++)
          b[i] = Number((sa.rootCodeHash >> BigInt(i * 8)) & 0xFFn);
        return b;
      })()
    : new Uint8Array(32);
  out.set(tc, p); p += 32;
  out.set(toLE(sa.balance & 0xFFFF_FFFF_FFFF_FFFFn, 8), p); p += 8;  // tb — 128-bit balance (hi | lo limbs) -- lo 64
  out.set(toLE(sa.balance >> 64n, 8), p); p += 8;     // hi 64
  out.set(toLE(sa.ticketNext, 8), p); p += 8;  // tt — ticketNext (64)
  out.set(toLE(sa.gasAccumulate, 8), p); p += 8;     // tg — gasAccumulate (64)
  out.set(toLE(sa.gasOnTransfer, 8), p); p += 8;     // tm — gasOnTransfer (64)
  out.set(toLE(BigInt(sa.coresOffset), 4) , p); p += 4;     // to — coresOffset (32)
  out.set(toLE(BigInt(sa.ticketIndex), 4), p);     // ti — ticketIndex (32)

  return out;
  }
  