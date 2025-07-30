import { readBytes }  from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { HUH } from "../consts";
import { HostCallHandler, MachineEntry } from "../types";
import { deblob } from "../../deblob";
import { finish } from "../helpers";

// ΩM  – machine (selector 20)
export const machineHandler: HostCallHandler = (s, _id, env) => {
  const pOff = Number(s.registers[7]);   // (po) program blob offset
  const pz   = Number(s.registers[8]);   // (pz) program blob length
  const opts = Number(s.registers[9]);   // (i) flag bits / options
  
  // p  – fetch candidate blob
  const { bytes: p, state: s1 } = readBytes(s, pOff, pz);
  if (!p) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };


  try { deblob(p) } catch { return finish(s1, HUH); } 

  // m  – machine table (create lazily)
  const tbl: Map<number, MachineEntry> = (env.machineTable ||= new Map<number, MachineEntry>());

  // n  – first unused machine‑ID
  let fstUnsdMachine = 0;
  while (tbl.has(fstUnsdMachine)) ++fstUnsdMachine;

  // u  – blank inner‑machine state (stub) !TODO, when we implement nested inner machine execution 
  // then we can add runMAchine helper
  const newMachineObject = { regs: new BigUint64Array(16).fill(0n), mem: new Uint8Array(0) };

  tbl.set(fstUnsdMachine, { p, u: newMachineObject, i: opts });

  // (success path) reg 7 will contain ID of the newly created machine
  return finish(s1, BigInt(fstUnsdMachine));
};
