import fs from "node:fs";

export function compareNdjson(oursPath: string, theirsPath: string) {
  const ours = fs.readFileSync(oursPath, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const theirs = fs.readFileSync(theirsPath, "utf8").trim().split("\n").map(l => JSON.parse(l));
  const n = Math.min(ours.length, theirs.length);
  for (let i = 0; i < n; i++) {
    if (!roughEqual(ours[i], theirs[i])) {
      return { index: i, ours: ours[i], theirs: theirs[i] };
    }
  }
  if (ours.length !== theirs.length) {
    return { index: n, oursLen: ours.length, theirsLen: theirs.length };
  }
  return null;
}
function roughEqual(a: any, b: any) {
  if (a.t !== b.t) return false;
  // ignore non-semantic fields if needed
  return JSON.stringify(a) === JSON.stringify(b);
}
