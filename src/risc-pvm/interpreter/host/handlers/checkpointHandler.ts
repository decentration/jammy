import { checkpointAcc } from "../helpers";
import { HostCallHandler } from "../types";

// ΩC – checkpoint (selector 8)
export const checkpointHandler: HostCallHandler = (s, _id, env) => {
  checkpointAcc(env);
  const regs = s.registers.slice();
  regs[7] = BigInt(s.gas);
  return { state: { ...s, registers: regs }, ok: true };
};
