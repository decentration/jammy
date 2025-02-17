import { Verdict, Culprit, Fault } from "../types";

/**
 * isSortedAndUniqueByReportHash:
 * For an array of Verdicts, ensures the array is strictly ascending by the `target` hash.
 */
export function isSortedAndUniqueByReportHash(verdicts: Verdict[]): boolean {
  if (verdicts.length < 2) return true;

  for (let i = 1; i < verdicts.length; i++) {
    const prev = verdicts[i - 1].target;
    const curr = verdicts[i].target;

    if (compareLexicographically(prev, curr) >= 0) {
      return false;
    }
  }
  return true;
}

/**
 * isSortedAndUniqueByValidatorKey: 
 * For an array of Culprits and Faults, ensures the array is strictly ascending by the `key` hash.
 */
export function isSortedAndUniqueByValidatorKey(records: (Culprit | Fault)[]): boolean {

  if (records.length < 2) return true;

  for (let i = 1; i < records.length; i++) {
    console.log(records[i].key, records[i - 1].key);
    const prevKey = records[i - 1].key;
    const currKey = records[i].key;
    if (compareLexicographically(prevKey, currKey) >= 0) {
      console.log("inside here the compareLexicographically is set to false which means the keys are not sorted");     
         return false;
    }
  }
  return true;
}

/**
 * isSortedAndUniqueByVoteIndex:
 * For the array of votes within a single Verdict, check ascending `index` with no duplicates.
 */
export function isSortedAndUniqueByVoteIndex(votes: { index: number }[]): boolean {
  if (votes.length < 2) return true;
  for (let i = 1; i < votes.length; i++) {
    if (votes[i].index <= votes[i - 1].index) {
      return false;
    }
  }
  return true;
}

/**
 * compareLexicographically:
 *   - returns negative if a < b
 *   - returns 0 if a == b
 *   - returns positive if a > b
 */
function compareLexicographically(a: Uint8Array, b: Uint8Array): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) {
      return a[i] - b[i];
    }
  }
  console.log(a.length, b.length);
  return a.length - b.length;
}
