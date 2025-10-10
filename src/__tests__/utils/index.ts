import * as fs from "fs";

const MAX_SAFE = 9007199254740991n;

export function normalizeForConformance(x: any): any {
  if (typeof x === "bigint") {
    return x <= MAX_SAFE ? Number(x) : x.toString(); // decimal string past safe range
  }
  if (Array.isArray(x)) return x.map(normalizeForConformance);
  if (x && typeof x === "object") {
    const out: any = {};
    for (const [k, v] of Object.entries(x)) out[k] = normalizeForConformance(v);
    return out;
  }
  return x;
}

/**
 * compareFilesByteByByte
 * Reads two files entirely into memory, then does a byte-by-byte comparison.
 * - Logs every mismatch with the index, plus hex representation of both bytes
 * - Logs total mismatch count
 * - Also checks if file lengths differ
 */
export function compareFilesByteByByte(pathA: string, pathB: string): void {
  const fileA = fs.readFileSync(pathA);
  const fileB = fs.readFileSync(pathB);

  if (fileA.length !== fileB.length) {
    console.log(`Length mismatch: A=${fileA.length}, B=${fileB.length}`);
  }

  const maxLen = Math.max(fileA.length, fileB.length);
  let diffCount = 0;

  for (let i = 0; i < maxLen; i++) {
    const aVal = i < fileA.length ? fileA[i] : undefined; 
    const bVal = i < fileB.length ? fileB[i] : undefined; 

    if (aVal !== bVal) {
      diffCount++;
      console.log(
        `Mismatch at byte #${i}: A=0x${(aVal ?? 0)
          .toString(16)
          .padStart(2, "0")} B=0x${(bVal ?? 0)
          .toString(16)
          .padStart(2, "0")}`
      );
    }
  }

  console.log(diffCount === 0 && fileA.length === fileB.length
      ? "Files match exactly (no differences)."
      : `Total differences found: ${diffCount}`
  )
};