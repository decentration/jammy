import { hexStringToBytes } from "../../../codecs";
import { compareBytes, toHex } from "../../../utils";
import type { AccumulateState } from "../types";

const norm = (s: string) => s.toLowerCase().replace(/^0x/, "");

const tryDecode = (v: any): Uint8Array | null => {
  if (v instanceof Uint8Array) return v;
  if (Array.isArray(v)) return new Uint8Array(v);
  if (typeof v === "string") {
    if (/^0x/i.test(v)) return hexStringToBytes(v);
    if (/^[0-9a-f]+$/i.test(v)) return new Uint8Array(Buffer.from(v, "hex"));
    try { return new Uint8Array(Buffer.from(v, "base64")); } catch { }
  }
  return null;
};

function pullFromObj(obj: Record<string, any> | undefined, k: string): Uint8Array | null {
  if (!obj) return null;
  return tryDecode(obj[k] ?? obj[k.toUpperCase()] ?? obj[norm(k)] ?? obj[norm(k).toUpperCase()]) ?? null;
}

function pullFromMap(m: Map<string, any> | undefined, k: string): Uint8Array | null {
  if (!m) return null;
  const want1 = k;
  const want2 = k.toUpperCase();
  const want3 = norm(k);
  const want4 = want3.toUpperCase();
  for (const [kk, vv] of m) {
    const s = String(kk);
    if (s === want1 || s === want2 || s === want3 || s === want4 || norm(s) === want3) {
      const dec = tryDecode(vv);
      if (dec) return dec;
    }
  }
  return null;
}

// search in account's preimages_blob first (that’s where vectors put code).
export function tryLoadServiceBlobForService(
  state: AccumulateState,
  serviceId: number,
  codeHash: Uint8Array
): Uint8Array | null {
  const wantHex = "0x" + Buffer.from(codeHash).toString("hex").padStart(64, "0");
  // 1) account-local preimages
  const acct = state.accounts.find(a => a.id === serviceId);
  if (acct?.data?.preimages_blob?.length) {
    for (const pi of acct.data.preimages_blob) {
      if (compareBytes(pi.hash, codeHash) === 0) {
        // pi.blob may be bytes already, but decode just in case
        const dec = tryDecode((pi as any).blob ?? pi.blob);
        if (dec) {
          console.log("[BLOB] hit account preimages", serviceId, "hash", toHex(pi.hash));
          return dec;
        }
      }
    }
  }

  // 2) state-level maps/objects (some harnesses stash them here)
  const fromMaps = pullFromMap((state as any).code_blobs, wantHex)
    || pullFromMap((state as any).blobs, wantHex);
  if (fromMaps) { console.log("[BLOB] hit code_blobs/blobs map", wantHex); return fromMaps; }

  const fromObjs = pullFromObj((state as any).code_blobs, wantHex)
    || pullFromObj((state as any).blobs, wantHex);
  if (fromObjs) { console.log("[BLOB] hit code_blobs/blobs obj", wantHex); return fromObjs; }

  // 3) scan all accounts preimages as a last resort
  for (const a of state.accounts) {
    for (const pi of a.data.preimages_blob ?? []) {
      if (compareBytes(pi.hash, codeHash) === 0) {
        const dec = tryDecode((pi as any).blob ?? pi.blob);
        if (dec) {
          console.log("[BLOB] hit other account preimages", a.id, "hash", toHex(pi.hash));
          return dec;
        }
      }
    }
  }

  console.log("[BLOB] miss", wantHex, "svc", serviceId);
  return null;
}
