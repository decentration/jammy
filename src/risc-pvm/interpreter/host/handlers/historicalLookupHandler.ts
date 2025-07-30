import { readBytes, writeBytes }      from "../../instructions/helpers";
import { ExitReasonType }             from "../../types";
import { NONE, WHO }                  from "../consts";
import { finish }                     from "../helpers";
import { HostCallHandler }            from "../types";

export const historicalLookupHandler: HostCallHandler = (s, _id, env) => {
  const srvIdx = BigInt.asUintN(64, s.registers[7]);
  const hOff   = Number(s.registers[8]);    // read 32 bytes from hOff and copy to dest [h,o]
  const dest   = Number(s.registers[9]);    // copy destination [h,o]
  const fOff   = Number(s.registers[10]);   // slice offset inside the value (f)
  let   len    = Number(s.registers[11]);   // slice length (0 -> to end)


  if (srvIdx !== NONE && !env.hasService?.(srvIdx)) return finish(s, WHO); // (a) account records

  const { bytes: hashBytes, state: s1 } = readBytes(s, hOff, 32);
  if (!hashBytes)
    return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  const value = env.historicalLookup?.(hashBytes) ?? undefined; // (v) 
  if (!value) return finish(s1, NONE);

  const Sv = value.length;
  const f  = Math.min(fOff, Sv);
  if (len === 0) len = Sv - f;
  const slice = value.subarray(f, f + Math.min(len, Sv - f));

  const s2 = writeBytes(s1, dest, slice);
  if (s2.exit?.type === ExitReasonType.PageFault)
    return { state:{ ...s1, exit:{ type: ExitReasonType.Panic } }, ok:true };

  const regs = s2.registers.slice();
  regs[7] = BigInt(Sv);
  return { state:{ ...s2, registers: regs }, ok:true };
};
