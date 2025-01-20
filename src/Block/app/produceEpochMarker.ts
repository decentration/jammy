import { EpochMark } from "../../types/types";
import { EPOCH_LENGTH } from "../../consts/tiny";

// Returns true if the given slot is the first block of a new epoch.
export function isEpochBoundary(slot: number): boolean {
    console.log('isEpochBoundary', slot, EPOCH_LENGTH);
  // new epoch every time slot is multiple of epoch length
  const result = (slot % EPOCH_LENGTH) === 0;
    console.log('isEpochBoundary result:', result);
  return result;
}

/** produce epoch marker. */
export function produceEpochMark(): EpochMark {
    console.log('produceEpochMark' );
   // TODO get “currentEntropy”, “nextEpochEntropy” and the new epoch’s validator keys...
  return {
    // 32 bytes for “entropy” placeholder
    entropy: new Uint8Array(32).fill(0xaa),

    // 32 bytes for “tickets_entropy” placeholder
    tickets_entropy: new Uint8Array(32).fill(0xbb),

    // placeholder array of validator public keys (Bandersnatch keys).
    validators: [
      new Uint8Array(32).fill(0x11),
      new Uint8Array(32).fill(0x22),
      new Uint8Array(32).fill(0x33),
      new Uint8Array(32).fill(0x44),
      new Uint8Array(32).fill(0x55),
      new Uint8Array(32).fill(0x66),
    ],
  };
}