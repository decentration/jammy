import { State } from "../state/types";
import { createMemTrieDB } from "./trie/mem_store";
import { buildTrieRoot }  from "./trie/builder";
import { serializeState } from "./serialization/chapters";

export function computeMerkleRoot(state: State) {

  const kvs: [Uint8Array, Uint8Array][] = [...serializeState(state)];

  const db   = createMemTrieDB();
  const root = buildTrieRoot(db, kvs);

  return { kvs, root, db };
}

