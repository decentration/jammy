import { toHex } from "../../utils";
import { hash } from "../../utils/crypto";

export interface MemTrieDB {
  get(h: Uint8Array): Uint8Array | undefined;
  put(node: Uint8Array): Uint8Array;
}

// TODO: create class perhaps, though perhaps slower in performance, but perhaps neglible. 
// TODO: swap with parityDB or RocksDB
export const createMemTrieDB = (): MemTrieDB => {
  const store = new Map<string, Uint8Array>();

  const get = (h: Uint8Array) => store.get(toHex(h));

  const put = (node: Uint8Array) => {
    const h = hash(node);
    store.set(toHex(h), node);
    return h;
  };

  return { get, put };
};