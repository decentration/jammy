import { asBytes } from "./helpers";
import { compareBytes } from "../../utils";
import { AccumulateEphemeral, AccumulateState } from "./types";
import { STORAGE_ENTRY_OVERHEAD } from "../../risc-pvm/interpreter/host/consts";


export function applyIntermediateChanges(
  state: AccumulateState,
  ephemerals: AccumulateEphemeral[],
  // allOutputs: any[],
  slot: number
): void {
  // Track bytes delta per service (positive = added, negative = removed)
  const bytesDelta = new Map<number, bigint>();
  const touched = new Set<number>();

  for (const ep of ephemerals) {
    const sid: number = ep.serviceId;
    const acc = state.accounts.find(a => a.id === sid);
    if (!acc) continue;

    let delta = 0n;

    // 1) apply storage deletes first - track bytes removed
    for (const k of ep.storageDeletes ?? []) {
      const hexKey = Buffer.from(k).toString("hex");
      const existing = acc.data.storage.find(
        e => Buffer.from(e.key).toString("hex") === hexKey
      );
      if (existing) {
        // Subtract key + value bytes + overhead
        delta -= BigInt(existing.key.length + existing.value.length + STORAGE_ENTRY_OVERHEAD);
      }
      acc.data.storage = acc.data.storage.filter(
        e => Buffer.from(e.key).toString("hex") !== hexKey
      );
    }

    // 2) apply storage writes (upsert) - track bytes added/changed
    for (const w of ep.storageWrites ?? []) {
      const hexKey = Buffer.from(w.key).toString("hex");
      const idx = acc.data.storage.findIndex(
        e => Buffer.from(e.key).toString("hex") === hexKey
      );
      if (idx >= 0) {
        // Update: remove old bytes, add new bytes
        const oldEntry = acc.data.storage[idx];
        delta -= BigInt(oldEntry.key.length + oldEntry.value.length);
        delta += BigInt(w.key.length + w.value.length);
        acc.data.storage[idx].value = w.value;
      } else {
        // Insert: add new bytes + overhead
        delta += BigInt(w.key.length + w.value.length + STORAGE_ENTRY_OVERHEAD);
        acc.data.storage.push({ key: w.key, value: w.value });
      }
    }

    if ((ep.storageWrites?.length ?? 0) + (ep.storageDeletes?.length ?? 0) > 0) {
      touched.add(sid);
      bytesDelta.set(sid, (bytesDelta.get(sid) ?? 0n) + delta);
    }
  }

  // 3) Update counters for touched services
  for (const sid of touched) {
    const acc = state.accounts.find(a => a.id === sid)!;
    acc.data.storage.sort((a, b) => Buffer.compare(a.key, b.key));

    // items = storage entries + preimage blobs + preimage status entries
    const storageCount = acc.data.storage.length;
    const data: any = acc.data;
    const preimageBlobs = data.preimage_blobs ?? data.preimages_blob ?? [];
    const preimageRequests = data.preimage_requests ?? data.preimages_status ?? [];
    const preimagesBlobCount = preimageBlobs.length;
    const preimagesStatusCount = preimageRequests.length;
    acc.data.service.items = storageCount + preimagesBlobCount + preimagesStatusCount;

    // Apply bytes delta to existing service.bytes (preserve original encoding overhead)
    const delta = bytesDelta.get(sid) ?? 0n;
    const currentBytes = typeof acc.data.service.bytes === 'bigint'
      ? acc.data.service.bytes
      : BigInt(acc.data.service.bytes);
    acc.data.service.bytes = currentBytes + delta;

    acc.data.service.last_accumulation_slot = slot;
  }
}