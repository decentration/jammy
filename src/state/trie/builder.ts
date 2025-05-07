import { MemTrieDB } from "./mem_store";
import { bit } from "./bit";
import { encodeBranch, encodeLeaf } from "./node";

export const ZERO_HASH = new Uint8Array(32);

export type ArrayOfTuples = [Uint8Array, Uint8Array][];

// recursive Merklization (D.6)
export const buildTrieRoot = (
  db   : MemTrieDB,
  kvs: ArrayOfTuples, // key-value pairs
  depth = 0
): Uint8Array => {
  if (kvs.length === 0) return ZERO_HASH;

  if (kvs.length === 1) {   // single leaf
    const [k, v] = kvs[0];
    const leaf = encodeLeaf(k, v);
    console.log("leaf", depth, k, v, leaf);
    return db.put(leaf);
  }

  // ...else if multiple leaves

  // each side left and right are an array of kv pair tuples [Uint8Array, Uint8Array][]
  const left:  ArrayOfTuples = [];
  const right: ArrayOfTuples = [];

  // for every kv pair of the current level 
  // split the key into left and right parts
  // and push them into the corresponding array
  // (left or right) depending on the value of the bit
  for (const kv of kvs) (bit(kv[0], depth) ? right : left).push(kv);


  const leftHash  = buildTrieRoot(db, left,  depth + 1);
  const rightHash = buildTrieRoot(db, right, depth + 1);

  const branch = encodeBranch(leftHash, rightHash);
  return db.put(branch);
};
