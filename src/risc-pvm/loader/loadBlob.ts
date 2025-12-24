import { createHash } from "crypto";

export type LoadedBlob = {
  endian: "LE" | "BE";
  entryPc: bigint;
  image: Uint8Array;       // raw program bytes
  hashHex: string;         // sha256 of canonical header+image
};

export function loadBlob(buf: Uint8Array): LoadedBlob {
  if (buf.length < 16) throw new Error("Blob too small");
  // Example: detect via magic/version/endianness flags (adapt to your spec)
  const leMagic = buf.slice(0, 4).toString() === "...."; // placeholder
  const beMagic = false; // detect…
  const endian = leMagic ? "LE" : beMagic ? "BE" : (() => { throw new Error("Unknown blob format"); })();

  // Read header fields using endian
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const oLen = endian === "LE" ? dv.getUint32(8, true) : dv.getUint32(8, false);
  const entry = endian === "LE" ? dv.getBigUint64(12, true) : dv.getBigUint64(12, false);

  const headerBytes = 64; // example; set to spec
  if (buf.length < headerBytes + oLen) throw new Error("BE/LE: header exceeds blob");

  const image = buf.slice(headerBytes, headerBytes + oLen);

  const h = createHash("sha256").update(buf.slice(0, headerBytes + oLen)).digest("hex");

  return { endian, entryPc: entry, image, hashHex: `0x${h}` };
}
