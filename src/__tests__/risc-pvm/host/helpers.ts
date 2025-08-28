import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { AccumulateContext, ServiceAccount } from "../../../risc-pvm/interpreter/host/types";

export function makeOpcodeBitmask(code: Uint8Array, opcodeOffsets: number[]): Uint8Array {
  const bits = new Uint8Array(Math.ceil(code.length / 8));
  for (const off of opcodeOffsets) bits[off >> 3] |= 1 << (off & 7);
  return bits;
}

export const le64 = (x: bigint) => [
  Number(x & 0xFFn),
  Number((x>>8n)&0xFFn),
  Number((x>>16n)&0xFFn),
  Number((x>>24n)&0xFFn),
  Number((x>>32n)&0xFFn),
  Number((x>>40n)&0xFFn),
  Number((x>>48n)&0xFFn),
  Number((x>>56n)&0xFFn),
];

export const le32 = (x: number) => [x&0xFF,(x>>>8)&0xFF,(x>>>16)&0xFF,(x>>>24)&0xFF];

export function le32ToBigInt(h: Uint8Array): bigint {
  let v = 0n;
  for (let i = 0; i < 32; i++) v |= BigInt(h[i]) << (8n * BigInt(i));
  return v;
}

export function makeBlob(code: Uint8Array, bitmask: Uint8Array): Uint8Array {
  return buildBlob({
    meta: Uint8Array.of(0),
    jumpTbl: Uint8Array.of(0),
    z: 1,
    instr: code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
}

export function mkService(
  _id: bigint,
  rootCodeHash: bigint = 0n,
  balance: bigint = 0n,
  extras: Partial<ServiceAccount> = {}
): ServiceAccount {
  return {
    storage: new Map(),
    preimages: new Map(),
    lookupStorage: new Map(),
    rootCodeHash,
    balance,
    gasAccumulate: 0n,
    gasOnTransfer: 0n,
    cores: new Uint8Array(0),
    selectorMap: new Map(),
    ticketNext: 0n,
    coresOffset: 0,
    ticketIndex: 0,
    ...extras,
  };
}


export function makePayer (
  _id: bigint, rootCodeHash: bigint, balance: bigint, coresOffset: number = 0
): ServiceAccount {
  return {
    storage: new Map(),
    preimages: new Map(),
    lookupStorage: new Map(),
    rootCodeHash,
    balance,
    gasAccumulate: 0n,
    gasOnTransfer: 0n,
    cores: new Uint8Array(0),
    selectorMap: new Map(),
    ticketNext: 0n,
    coresOffset,
    ticketIndex: 0,
  };
}

export const makeAcc = (currentServiceId: bigint): AccumulateContext => ({
  allocator: { index: 0n, env: { deltas: new Map(), 
  currentServiceId: currentServiceId, root: 0n } },
  session: { 
    scratch: {} 
  },
});