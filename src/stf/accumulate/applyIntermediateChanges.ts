import { asBytes } from "./helpers";
import { compareBytes } from "../../utils";
import { AccumulateEphemeral, AccumulateState } from "./types";

export function applyIntermediateChanges(
  state: AccumulateState,
  ephemerals: AccumulateEphemeral[],
  // allOutputs: any[],
  slot: number
): void {
  const touched = new Set<number>();   // writes or transfers or deltas

  for (const ep of ephemerals) {
    // for (const entry of out?.ephemeralForThisReport ?? []) {
      const sid: number = ep.serviceId;
      const acc = state.accounts.find(a => a.id === sid);
      if (!acc) continue;

      // 1) apply storage deletes first
      for (const k of ep.storageDeletes ?? []) {
        const hexKey = Buffer.from(k).toString("hex");
        acc.data.storage = acc.data.storage.filter(
          e => Buffer.from(e.key).toString("hex") !== hexKey
        );
      }
      // 2) apply storage writes (upsert)
      for (const w of ep.storageWrites ?? []) {
        const hexKey = Buffer.from(w.key).toString("hex");
        const idx = acc.data.storage.findIndex(
          e => Buffer.from(e.key).toString("hex") === hexKey
        );
        if (idx >= 0) {
          acc.data.storage[idx].value = w.value;
        } else {
          acc.data.storage.push({ key: w.key, value: w.value });
        }
      }
  
      if ((ep.storageWrites?.length ?? 0) + (ep.storageDeletes?.length ?? 0) > 0) {
        touched.add(sid);
      }
    // }
  }

  // 3) Recompute counters from storage AND preimages for touched services
  for (const sid of touched) {
    const acc = state.accounts.find(a => a.id === sid)!;
    acc.data.storage.sort((a, b) => Buffer.compare(a.key, b.key));
    
    // items = storage entries + preimage blobs + preimage status entries
    const storageCount = acc.data.storage.length;
    const preimagesBlobCount = (acc.data.preimages_blob ?? []).length;
    const preimagesStatusCount = (acc.data.preimages_status ?? []).length;
    acc.data.service.items = storageCount + preimagesBlobCount + preimagesStatusCount;
    
    // bytes = sum of storage values + sum of preimage blobs
    const storageBytes = acc.data.storage.reduce((sum, e) => sum + e.value.length, 0);
    const preimagesBytes = (acc.data.preimages_blob ?? []).reduce((sum, p) => {
      const blob = p.blob;
      return sum + (blob instanceof Uint8Array ? blob.length : 0);
    }, 0);
    acc.data.service.bytes = BigInt(storageBytes + preimagesBytes);
    
    acc.data.service.last_accumulation_slot = slot;
  }
}