export function stripManifestHeaderIfPresent(buf: Uint8Array): Uint8Array {
    // Non-spec G manifest used in test vectors
    if (buf.length < 3 || buf[0] !== 0x47 /* 'G' */) return buf;
    let off = 1; // G
    off += 1;    // versionByte
    const need = (n: number) => { if (off + n > buf.length) throw new Error("manifest truncated"); };
    need(1); const nameLen = buf[off++]; need(nameLen); off += nameLen;
    need(1); const verLen  = buf[off++]; need(verLen);  off += verLen;
    need(1); const licLen  = buf[off++]; need(licLen);  off += licLen;
    need(1); const authors = buf[off++];
    for (let i = 0; i < authors; i++) { need(1); const alen = buf[off++]; need(alen); off += alen; }
    return buf.slice(off);
  }
  
  