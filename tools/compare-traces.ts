import fs from "node:fs";

type Row = { t:string; [k:string]: any };
function* readNDJSON(path: string): Generator<Row> {
  const lines = fs.readFileSync(path, "utf8").split("\n");
  for (const line of lines) if (line.trim()) yield JSON.parse(line);
}

const [,, ours, theirs] = process.argv;
const A = readNDJSON(ours);
const B = readNDJSON(theirs);

let i = 0;
for (;;) {
  const ar = A.next(); const br = B.next();
  if (ar.done || br.done) {
    if (ar.done && br.done) { console.log("MATCH: traces align"); process.exit(0); }
    console.error("LENGTH MISMATCH at", i);
    process.exit(1);
  }
  const a = ar.value, b = br.value;
  if (!roughEqual(a,b)) {
    console.error("FPoD at row", i);
    console.error("Ours:  ", a);
    console.error("Theirs:", b);
    process.exit(1);
  }
  i++;
}

function roughEqual(a: Row, b: Row) {
  if (a.t !== b.t) return false;
  // tolerant compare—e.g., allow equivalent gas formats, ignore non-semantic fields
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k === "gasUsed") {
      if (String(a[k]) !== String(b[k])) return false;
    } else if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) return false;
  }
  return true;
}
