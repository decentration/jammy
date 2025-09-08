import { ZP } from "../consts";
import { Access, InnerMachineState } from "./types";



export const pageOf = (addr: number) => addr >>> 12;
export const offInPage = (addr: number) => addr & (ZP - 1);

export function ensureInnerMem(u: any): InnerMachineState {
  if (u && u.vPages && u.aPages) return u as InnerMachineState;
  return { vPages: new Map(), aPages: new Map() };
}

export const getAccess = (u: InnerMachineState, page: number): Access =>
  u.aPages.get(page) ?? 0;

export const setAccess = (u: InnerMachineState, page: number, mode: Access) => {
  if (mode === 0) u.aPages.delete(page);
  else u.aPages.set(page, mode);
};

export const zeroPage = (u: InnerMachineState, page: number) => {
  const buf = u.vPages.get(page);
  if (buf) buf.fill(0);
  else u.vPages.set(page, new Uint8Array(ZP));
};

// permissions
export function innerReadable(u: InnerMachineState, off: number, len: number): boolean {
  if (len === 0) return true;
  let pos = off, rem = len;
  while (rem > 0) {
    const p = pos >>> 12;
    const access = u.aPages.get(p) ?? 0;
    if (access === 0) return false;     // ∅ => not readable
    const n = Math.min(rem, ZP - (pos & (ZP - 1)));
    rem -= n; pos += n;
  }
  return true; // R or W are both readable
}

export function innerWritable(u: InnerMachineState, off: number, len: number): boolean {
  if (len === 0) return true;
  let pos = off, rem = len;
  while (rem > 0) {
    const p = pos >>> 12;
    const access = u.aPages.get(p) ?? 0;
    if (access !== 2) return false;
    const n = Math.min(rem, ZP - (pos & (ZP - 1)));
    rem -= n; pos += n;
  }
  return true;
}

export function innerRead(u: InnerMachineState, off: number, len: number): Uint8Array | null {
  if (!innerReadable(u, off, len)) return null;
  const out = new Uint8Array(len);
  let pos = off, rem = len, dst = 0;
  while (rem > 0) {
    const p = pageOf(pos);
    const buf = u.vPages.get(p);
    if (!buf) return null;
    const inPage = Math.min(rem, ZP - offInPage(pos));
    out.set(buf.subarray(offInPage(pos), offInPage(pos) + inPage), dst);
    dst += inPage; pos += inPage; rem -= inPage;
  }
  return out;
}

export function innerWrite(u: InnerMachineState, off: number, data: Uint8Array): boolean {
  if (!innerWritable(u, off, data.length)) return false;
  let pos = off, rem = data.length, src = 0;
  while (rem > 0) {
    const p = pageOf(pos);
    let buf = u.vPages.get(p);
    if (!buf) { buf = new Uint8Array(ZP); u.vPages.set(p, buf); }
    const inPage = Math.min(rem, ZP - offInPage(pos));
    buf.set(data.subarray(src, src + inPage), offInPage(pos));
    src += inPage; pos += inPage; rem -= inPage;
  }
  return true;
}
