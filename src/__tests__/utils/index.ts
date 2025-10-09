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