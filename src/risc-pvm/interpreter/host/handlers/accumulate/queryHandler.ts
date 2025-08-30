import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { NONE } from "../../consts";
import { finish } from "../../helpers";
import { HostCallHandler } from "../../types";
import { getMergedXs } from "./helpers";

// query handler (ΩQ) — selector 25
export const queryHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]); // (o)
  const z = Number(s.registers[8]);   // (z)

  const { bytes: h, state: s1 } = readBytes(s, off, 32);
  if (!h) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  const xs = getMergedXs(env);
  if (!xs) return finish(s1, NONE);

  const hHex  = Buffer.from(h).toString("hex");
  const bytes = xs.ledger?.get(hHex)?.get(z);

  if (!bytes) {
    const r = s1.registers.slice();
    r[7] = NONE;
    r[8] = 0n;
    return { state: { ...s1, registers: r }, ok: true };
  }

  // decode a
  const len = bytes.length >>> 3; // number of u64s present >=0, divide by 8
  const dv  = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); // we use DataView because 
  
  // read u64 at index i
  const u64 = (i: number) => {
    let v = 0n;
    for (let b = 0; b < 8; b++) v |= BigInt(dv.getUint8(i*8 + b)) << BigInt(8*b);
    return v;
  };

  // read u64 at index i and shift left 32 bits
  const u32 = (i: number) => u64(i) << 32n;

  const regs = s1.registers.slice();
  switch (len) {
    case 0:
      regs[7] = 0n;
      regs[8] = 0n;
      break;
    case 1:
      regs[7] = 1n + u32(0);  // x   
      regs[8] = 0n; 
      break; 
    case 2:
      regs[7] = 2n + u32(0);   // x
      regs[8] = u64(1);        // y
      break; 
    default:
      regs[7] = 3n + u32(0);     // x 
      regs[8] = u64(1) + u32(2); // y, z
  }
  return { state: { ...s1, registers: regs }, ok: true };
};
