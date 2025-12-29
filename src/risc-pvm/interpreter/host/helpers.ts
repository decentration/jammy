import { u32, u64 } from "scale-ts";
import { fromLE, toLE } from "../instructions/helpers";
import { InterpreterState } from "../types";
import { BI, BL, BS, BYTES_PER_SLOT, C, CORES_SIZE, D, E, F, GA, GI, GR, GT, H, HUH, I, INFO_BYTES, J, K, L, N, O, P, Q, R, RING_SPAN, RING_START, S, STEP, T, U, V, WA, WB, WC, WE, WG, WM, WP, WR, WT, WX, Y, ZA, ZI, ZP, ZZ } from "./consts";
import { AccEnv, AccumulateContext, DesignationEntry, DesignationMap, FetchVector, ServiceAccount, ServiceId } from "./types";
import { HostEnvInterface } from "./hostEnvInterface";


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
  // Debugging: Log key parameters to check for mismatches
  console.log("DEBUG: buildFetchConfigVector params:", {
    BI, BL, BS, C, D, E, GA, GI, GR, GT, H, I, J, K, L, N, O, P, Q, R, T, U, V, WA, WB, WC, WE, WG, WM, WP, WR, WT, WX, Y
  });
  const enc = (x: number | bigint, bytes: 2 | 4 | 8) =>
    toLE(typeof x === "bigint" ? x : BigInt(x), bytes);

  // Graypaper v0.7.1 Appendix B.5 (ΩY fetch, φ10 = 0) defines the exact protocol-parameters
  // encoding as a concatenation of little-endian integers:
  //
  //   E8(BI), E8(BL), E8(BS),
  //   E2(C), E4(D), E4(E),
  //   E8(GA), E8(GI), E8(GR), E8(GT),
  //   E2(H), E2(I), E2(J), E2(K),
  //   E4(L),
  //   E2(N), E2(O), E2(P), E2(Q), E2(R), E2(T), E2(U), E2(V),
  //   E4(WA), E4(WB), E4(WC), E4(WE), E4(WM), E4(WP), E4(WR), E4(WT), E4(WX), E4(Y)
  //
  // NOTE: This is version-sensitive; do not “widen” fields to 32-bit unless the spec says so.
  const parts: Uint8Array[] = [
    // Alphabetical order per Graypaper B.5
    enc(BI, 8),
    enc(BL, 8),
    enc(BS, 8),
    enc(C, 2),
    enc(D, 4),
    enc(E, 4),
    // F excluded per B.5
    enc(GA, 8),
    enc(GI, 8),
    enc(GR, 8),
    enc(GT, 8),
    enc(H, 2),
    enc(I, 2),
    enc(J, 2),
    enc(K, 2),
    enc(L, 4),
    // M not in spec
    enc(N, 2),
    enc(O, 2),
    enc(P, 2),
    enc(Q, 2),
    enc(R, 2),
    // S excluded per B.5
    enc(T, 2), // T: Max extrinsics in work package (must be < E for service validation)
    enc(U, 2),
    enc(V, 2),
    enc(WA, 4),
    enc(WB, 4),
    enc(WC, 4),
    enc(WE, 4),
    // WG excluded per B.5
    enc(WM, 4),
    enc(WP, 4),
    enc(WR, 4),
    enc(WT, 4),
    enc(WX, 4),
    enc(Y, 4),
  ];

  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const part of parts) {
    out.set(part, o);
    o += part.length;
  }
  return out;
};

export type finishState = { state: InterpreterState; ok: boolean };

export function finish(s: InterpreterState, c: bigint): finishState {
  return {
    // Host-calls return their primary result in r7.
    // Conformance service ABI: r6 is treated as an error-code register and must be 0 on success.
    state: { ...s, registers: Object.assign([], s.registers, { 6: 0n, 7: c }) },
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
  out.set(toLE(BigInt(sa.coresOffset ?? 0), 4), p); p += 4;     // to — coresOffset (32)
  out.set(toLE(BigInt(sa.ticketIndex ?? 0), 4), p);     // ti — ticketIndex (32)

  return out;
}


// checkpoint helper
export function checkpointAcc(env: { acc: AccumulateContext }) {
  env.acc.session.checkpoint = structuredClone(env.acc.allocator);
}


export function nextIdInRing(current: bigint): bigint {

  const off = (current - RING_START + RING_SPAN) % RING_SPAN;
  return RING_START + ((off + STEP) % RING_SPAN);
}

// export function checkAlloc(env: HostEnvInterface, i: bigint): bigint {
//   let candidate = i;
//   while (
//     env.acc.allocator.env.deltas.has(candidate) ||
//     (env.hasService?.(candidate) ?? false) ||
//     env.acc.allocator.env.deleted?.has(candidate)
//   ) {
//     candidate = nextIdInRing(candidate);
//   }
//   return candidate;
// }

export function checkAlloc(env: HostEnvInterface, i: bigint): bigint {
  let candidate = i;
  const xe = env.acc?.allocator?.env as any;
  for (; ;) { // loop until we find a free candidate
    const staged = xe?.deltas?.has?.(candidate) ?? false;
    const live = env.hasService?.(candidate) ?? false;
    const deleted = xe?.deleted?.has?.(candidate) ?? false;
    if (!staged && !live && !deleted) return candidate;
    candidate = nextIdInRing(candidate);
  }
}


export type DecodedDesignations = {
  designations: DesignationMap;                            // slotIndex -> destId
  entries: Map<ServiceId, DesignationEntry>;               // destId -> entry
};

// for designateHandler 
export const decodeDesignationsVector = (v: Uint8Array): DecodedDesignations | null => { //v is the memory slice

  if (v.length === 0) return { designations: new Map(), entries: new Map() };;
  if (v.length % BYTES_PER_SLOT !== 0) return null

  const designations: DesignationMap = new Map();
  const entries = new Map<ServiceId, DesignationEntry>();

  for (let i = 0; i < v.length; i += BYTES_PER_SLOT) { // for each 336-byte slot 

    const slotIdx = i / BYTES_PER_SLOT;

    const destId = fromLE(v, i, 8);

    designations.set(slotIdx, destId);


    // v.subarray(i, i + BYTES_PER_SLOT)); 
    // we set the index to the bigint value at offset i
    if (!entries.has(destId)) {
      entries.set(destId, {
        boundCodeHash32: new Uint8Array(0),
        role: 0,
        witnessBaseOffset: 0,
        witnessIndex: new Map()
      });
    }
  }

  return { designations, entries };
};


// Decode [x,y] from the 16-byte payload (little-endian 64-bit each)
export const readU64LE = (u: Uint8Array, o: number) =>
  (BigInt(u[o + 0])) | (BigInt(u[o + 1]) << 8n) | (BigInt(u[o + 2]) << 16n) | // bitwise OR combining bits
  (BigInt(u[o + 3]) << 24n) | (BigInt(u[o + 4]) << 32n) | (BigInt(u[o + 5]) << 40n) |
  (BigInt(u[o + 6]) << 48n) | (BigInt(u[o + 7]) << 56n);


export const zeroService = (): ServiceAccount => ({
  storage: new Map(), preimages: new Map(), lookupStorage: new Map(),
  rootCodeHash: 0n, balance: 0n, gasAccumulate: 0n, gasOnTransfer: 0n,
  cores: new Uint8Array(CORES_SIZE), selectorMap: new Map(),
  ticketNext: 0n, coresOffset: 0, ticketIndex: 0,
});

// CLONE HELPERS
export const cloneObj = <T>(o?: T) => (o ? { ...o } : undefined);
export const cloneMap = <K, V>(m?: Map<K, V>) => new Map<K, V>(m ?? []);
export const cloneSet = <T>(s?: Set<T>) => new Set<T>(s ?? []);
export const cloneU8 = (u?: Uint8Array) => (u ? u.slice() : undefined);

// for designate handler
export const cloneEntry = (e: DesignationEntry) => ({
  boundCodeHash32: e.boundCodeHash32.slice(),
  role: e.role,
  witnessBaseOffset: e.witnessBaseOffset,
  witnessIndex: e.witnessIndex
    ? new Map([...e.witnessIndex].map(([k, v]) => [k, { x: v.x, y: v.y }]))
    : undefined,
});


export function hydrateAccEnv(xeLike: Partial<AccEnv> | undefined): AccEnv {
  const deltas =
    xeLike?.deltas instanceof Map
      ? xeLike!.deltas as Map<bigint, ServiceAccount>
      : new Map<bigint, ServiceAccount>();

  const deleted =
    xeLike?.deleted instanceof Set
      ? xeLike!.deleted as Set<bigint>
      : new Set<bigint>();

  return {
    deltas,
    deleted,
    currentServiceId: xeLike?.currentServiceId,
    root: xeLike?.root,
    designations:
      xeLike?.designations instanceof Map ? xeLike.designations : new Map(),
    designationsRaw:
      xeLike?.designationsRaw ? xeLike.designationsRaw.slice() : undefined,
    assignServiceAccount:
      xeLike?.assignServiceAccount instanceof Map ? xeLike.assignServiceAccount : new Map(),
    assignCore:
      xeLike?.assignCore instanceof Map ? xeLike.assignCore : new Map(),
    designationEntries:
      xeLike?.designationEntries instanceof Map ? xeLike.designationEntries : new Map(),
  };
}