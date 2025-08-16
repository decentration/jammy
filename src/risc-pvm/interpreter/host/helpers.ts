import { u32, u64 } from "scale-ts";
import { toLE } from "../instructions/helpers";
import { InterpreterState } from "../types";
import { BI, BL, BS, C, D, E, GA, GI, GR, GT, H, I, INFO_BYTES, J, L, O, P, Q, R, S, T, U, V, WA, WB, WC, WE, WG, WM, WP, WR, WT, WX, Y } from "./consts";
import { AccumulateContext, FetchVector, ServiceAccount } from "./types";


// // ΩY fetch vector selector map 
// // This is a lookup table thats turns the value in register[10] into which blob the fetch function should return 
// export const fetchVecSelectorMap: Record<number, FetchVector | undefined> = {
//     0: "config",        // c
//     1: "paramBlob",       // n
//     2: "returnBlob",      // r
//     // 3‑6: imports / work‑items variants (x / i)
//     3: "imports", 4: "workItems", 5: "imports", 6: "imports",
//     // 7‑13: program‑blob sub‑vectors (p...)
//     7: "paramBlob", 8: "paramBlob", 9: "paramBlob",
//     10: "paramBlob", 11: "paramBlob", 12: "paramBlob", 13: "paramBlob",
//     // 14‑15: authoriser trace (o)
//     14: "authoriserTrace", 15: "authoriserTrace",
//     // 16‑17: transfer list (t)
//     16: "transferList", 17: "transferList"
// };

export const buildFetchConfigVector = (): Uint8Array => {
  const u8 = (x: number, bytes: 2 | 4 | 8) => toLE(BigInt(x >>> 0), bytes); // return to converted unsigned integer
  const parts: Uint8Array[] = [
    u8(BI,8), u8(BL,8), u8(BS,8), u8(C,2), u8(D,4), u8(E,4),
    u8(GA,8), u8(GI,8), u8(GR,8), u8(GT,8), u8(H,2), u8(I,2), u8(J,2),
    u8(L,4), u8(O,2), u8(P,2), u8(Q,2), u8(R,2), u8(S,2), u8(T,2), u8(U,2), u8(V,2),
    u8(WA,4), u8(WB,4), u8(WC,4), u8(WE,4), u8(WG,4), u8(WM,4), u8(WP,4),
    u8(WR,4), u8(WT,4), u8(WX,4), u8(Y,4),
  ];
  const out = new Uint8Array(parts.reduce((n,p)=>n+p.length,0));
  let p = 0; for (const part of parts) { out.set(part, p); p += part.length; }
  return out;
};

export function finish(s: InterpreterState, c: bigint) { 
    return { 
        state: { ...s, registers: Object.assign([], s.registers, { 7: c }) }, 
        ok: true 
    };
}


// B.6 (info general function) -->  (m) --> E(tc,tb,tt,tg,tm,to,ti) encoder
export function encodeInfoHelper(sa: ServiceAccount): Uint8Array {
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
  out.set(toLE(sa.ticketNext ?? 0n, 8), p); p += 8;  // tt — ticketNext (64)
  out.set(toLE(sa.gasAccumulate, 8), p); p += 8;     // tg — gasAccumulate (64)
  out.set(toLE(sa.gasOnTransfer, 8), p); p += 8;     // tm — gasOnTransfer (64)
  out.set(toLE(BigInt(sa.coresOffset ?? 0), 4) , p); p += 4;     // to — coresOffset (32)
  out.set(toLE(BigInt(sa.ticketIndex ?? 0), 4), p);     // ti — ticketIndex (32)

  return out;
}
  

// checkpoint helper
export function checkpointAcc(env: { acc: AccumulateContext }) {
  env.acc.session.scratch = structuredClone(env.acc.allocator);
}

export const RING_START = 1n << 8n;
export const STEP  = 1n << 9n;
export const RING_SPAN = (1n << 32n) - RING_START;

export function nextIdInRing(current: bigint): bigint {
  
  const off   = (current - RING_START + RING_SPAN) % RING_SPAN;
  return RING_START + ((off + STEP) % RING_SPAN);
}

export function checkAlloc(i: bigint): bigint {
  return i; // !TODO stub for now
}

