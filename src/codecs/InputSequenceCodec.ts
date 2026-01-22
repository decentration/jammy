/**
 * InputSequenceCodec.ts
 * 
 * Encodes the input sequence (i^T ⌢ i^U) for FETCH selector 14.
 * Per Graypaper:
 * - B.5: Selector 14 returns E(↕i) where i is the input sequence
 * - C.33: E(x ∈ I) = E(0, E_U(o)) if x ∈ U (work items)
 *                   = E(1, E_X(o)) if x ∈ X (transfers)
 * - C.29: E_U(x) = E(x_p, x_e, x_a, x_y, x_g, O(x_l), ↕x_t)
 * - C.31: E_X(x) = E(E4(x_s), E4(x_d), E8(x_a), x_m, E8(x_g))
 * - C.5/C.6: ↕x ≡ (|x|, x) thus E(↕x) ≡ E(|x|) ⌢ E(x)
 */

import { encodeProtocolInt } from './IntegerCodec';

/**
 * Operand tuple U - work item data per 12.14
 */
export interface OperandU {
    p: Uint8Array;   // package hash (32 bytes)
    e: Uint8Array;   // exports root (32 bytes)
    a: Uint8Array;   // authorizer hash (32 bytes)
    y: Uint8Array;   // payload hash (32 bytes)
    g: bigint;       // gas limit
    l?: Uint8Array;  // result (optional)
    t?: Uint8Array;  // authorizer trace (optional)
}

/**
 * Transfer X - deferred transfer per 12.14
 */
export interface TransferX {
    s: number;       // sender service index
    d: number;       // destination service index
    a: bigint;       // amount
    m: Uint8Array;   // memo (WT = 128 bytes)
    g: bigint;       // gas limit
}

/**
 * Input item - either work item or transfer
 */
export type InputI =
    | { type: 'workItem'; data: OperandU }
    | { type: 'transfer'; data: TransferX };

/**
 * Helper: Encode little-endian 32-bit integer
 */
function encodeE4(x: number): Uint8Array {
    const buf = new Uint8Array(4);
    buf[0] = x & 0xff;
    buf[1] = (x >> 8) & 0xff;
    buf[2] = (x >> 16) & 0xff;
    buf[3] = (x >> 24) & 0xff;
    return buf;
}

/**
 * Helper: Encode little-endian 64-bit integer
 */
function encodeE8(x: bigint): Uint8Array {
    const buf = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
        buf[i] = Number((x >> BigInt(8 * i)) & 0xffn);
    }
    return buf;
}

/**
 * Concatenate multiple Uint8Arrays
 */
function concatAll(...arrays: Uint8Array[]): Uint8Array {
    const totalLen = arrays.reduce((acc, a) => acc + a.length, 0);
    const result = new Uint8Array(totalLen);
    let offset = 0;
    for (const arr of arrays) {
        result.set(arr, offset);
        offset += arr.length;
    }
    return result;
}

/**
 * Encode O(x) - Optional encoding
 * Per Graypaper: O(x) = (0, ↕x) if x ∈ B (blob present)
 *                     = 1 if x = ∞ (not present/error)
 */
function encodeOptional(x: Uint8Array | undefined): Uint8Array {
    if (x === undefined) {
        return new Uint8Array([1]); // Not present
    }
    // Present: 0 prefix + length-prefixed data
    const lenEnc = encodeProtocolInt(x.length);
    return concatAll(new Uint8Array([0]), lenEnc, x);
}

/**
 * Encode E_U per C.29: E(x_p, x_e, x_a, x_y, x_g, O(x_l), ↕x_t)
 */
export function encodeOperandU(u: OperandU): Uint8Array {
    const parts: Uint8Array[] = [];

    // x_p: package hash (32 bytes, fixed)
    parts.push(u.p);

    // x_e: exports root (32 bytes, fixed)
    parts.push(u.e);

    // x_a: authorizer hash (32 bytes, fixed)
    parts.push(u.a);

    // x_y: payload hash (32 bytes, fixed)
    parts.push(u.y);

    // x_g: gas (protocol varint)
    parts.push(encodeProtocolInt(u.g));

    // O(x_l): optional result
    parts.push(encodeOptional(u.l));

    // ↕x_t: length-prefixed authorizer trace
    const t = u.t ?? new Uint8Array(0);
    parts.push(encodeProtocolInt(t.length));
    parts.push(t);

    return concatAll(...parts);
}

/**
 * Encode E_X per C.31: E(E4(x_s), E4(x_d), E8(x_a), x_m, E8(x_g))
 */
export function encodeTransferX(x: TransferX): Uint8Array {
    return concatAll(
        encodeE4(x.s),
        encodeE4(x.d),
        encodeE8(x.a),
        x.m,  // memo (128 bytes fixed)
        encodeE8(x.g)
    );
}

/**
 * Encode a single input item per C.33
 * E(x ∈ I) = E(0, E_U(o)) if x ∈ U (work item)
 *          = E(1, E_X(o)) if x ∈ X (transfer)
 */
export function encodeInputItem(item: InputI): Uint8Array {
    if (item.type === 'workItem') {
        return concatAll(
            new Uint8Array([0]),  // discriminator for work item
            encodeOperandU(item.data)
        );
    } else {
        return concatAll(
            new Uint8Array([1]),  // discriminator for transfer
            encodeTransferX(item.data)
        );
    }
}

/**
 * Encode the full input sequence E(↕i) for FETCH selector 14
 * Per C.5/C.6: ↕x ≡ (|x|, x) thus E(↕x) ≡ E(|x|) ⌢ E(x)
 * 
 * This encodes: sequence_length + [encoded_item0, encoded_item1, ...]
 */
export function encodeInputSequence(items: InputI[]): Uint8Array {
    // Encode each item
    const encodedItems = items.map(encodeInputItem);

    // Concatenate all encoded items
    const itemsConcat = concatAll(...encodedItems);

    // E(↕i) = E(|i|) ⌢ E(i)
    // The length is the NUMBER of items, not byte length
    const lengthEnc = encodeProtocolInt(items.length);

    return concatAll(lengthEnc, itemsConcat);
}

/**
 * Build input sequence from work items and their contexts
 * This is the main entry point for accumulation
 */
export function buildAccumulateInputSequence(
    workItems: Array<{
        packageHash: Uint8Array;
        exportsRoot: Uint8Array;
        authorizerHash: Uint8Array;
        payloadHash: Uint8Array;
        gas: bigint;
        result?: Uint8Array;
        authorizerTrace?: Uint8Array;
    }>,
    transfers: TransferX[] = []
): Uint8Array {
    const items: InputI[] = [];

    // Add transfers first (i^T)
    for (const t of transfers) {
        items.push({ type: 'transfer', data: t });
    }

    // Add work items (i^U)
    for (const w of workItems) {
        items.push({
            type: 'workItem',
            data: {
                p: w.packageHash,
                e: w.exportsRoot,
                a: w.authorizerHash,
                y: w.payloadHash,
                g: w.gas,
                l: w.result,
                t: w.authorizerTrace,
            }
        });
    }

    return encodeInputSequence(items);
}
