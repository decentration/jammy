import { ProgramContainerParts } from "./types";
import { readN } from "./utils";

// (A.38) Parse the standard program container
// returns container parts with human readable names 
// Otherwise returns null and the caller should treat input as raw blob
export function parseProgramContainer(buf: Uint8Array): ProgramContainerParts | null {

  // parse once with a given endianness
  const parseOnce = (le: boolean): ProgramContainerParts | null => {
    let off = 0;
    const R = (o: number, n: number, le: boolean) => readN(buf, o, n, le);

    const step1 = R(off, 3, le); if (!step1) return null; const [roLen, off1] = step1;
    const step2 = R(off1, 3, le); if (!step2) return null; const [rwLen, off2] = step2;
    const step3 = R(off2, 2, le); if (!step3) return null; const [reservePages, off3] = step3;
    const step4 = R(off3, 3, le); if (!step4) return null; const [stackSizeBytes, off4] = step4;

    if (off4 + roLen + rwLen + 4 > buf.length) return null;

    const roStart = off4;
    const roEnd = roStart + roLen;
    const rwStart = roEnd;
    const rwEnd = rwStart + rwLen;

    const step5 = R(rwEnd, 4, le); if (!step5) return null; const [codeLen, off5] = step5;
    if (off5 + codeLen > buf.length) return null;

    const readOnly = buf.slice(roStart, roEnd);       // o
    const readWrite = buf.slice(rwStart, rwEnd);       // w
    const code = buf.slice(off5, off5 + codeLen); // c

    if (process.env.JAM_DEBUG_PARSE === "1") {
      console.log(`[parseProgramContainer] roLen=${roLen} rwLen=${rwLen} reservePages=${reservePages} stackSizeBytes=${stackSizeBytes} codeLen=${codeLen}`);
    }

    return { readOnly, readWrite, reservePages, stackSizeBytes, code };
  };


  // Try BE first (spec text), then LE (many vectors)
  return parseOnce(false) ?? parseOnce(true);
}