import { readBytes }  from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { HUH } from "../../consts";
import { HostCallHandler } from "../../types";
import { deblob } from "../../../deblob";
import { finish } from "../../helpers";
import { MachineEntry } from "../../innerMem/types";
import { ensureInnerMem } from "../../innerMem/helpers";



// ΩM  – machine (selector 20)
export const machineHandler: HostCallHandler = (s, _id, env) => {
  const pOff = Number(s.registers[7]);   // (po) program blob offset
  const pz   = Number(s.registers[8]);   // (pz) program blob length
  const i0 = Number(s.registers[9]);   // (i) initial instruction pointer
  
  // p  – fetch candidate blob
  const { bytes: p, state: s1 } = readBytes(s, pOff, pz);
  if (!p) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };


  try { deblob(p) } catch { return finish(s1, HUH); } 

  // m  – machine table (create lazily)
  const tbl: Map<number, MachineEntry> = (env.machineTable ||= new Map<number, MachineEntry>()); 

  // n  – first unused machine‑ID
  let firstUnsdMachine = 0;
  while (tbl.has(firstUnsdMachine)) ++firstUnsdMachine; // the difference between ++x and x++ is 

  // u  – new machine object
  const u = ensureInnerMem(undefined); 

  tbl.set(firstUnsdMachine, { p, u: u, i: i0 });

  // (success path) reg 7 will contain ID of the newly created machine
  return finish(s1, BigInt(firstUnsdMachine));
};
