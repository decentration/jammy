import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { ACTIVATION_FEE, CASH, CORES_SIZE, HASH_BYTES, MAX_LABEL, OK, SVC_ID, WHO } from "../consts";
import { checkAlloc, finish, nextIdInRing } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";


// ΩU – updgrade (selector 10)
export const upgradeHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]);                   // (o) – offset pointer to 32-byte code-hash
  console.log("upgradeHandler off", off);
  const gasAcc = BigInt.asUintN(64, s.registers[8]);    // (g) – min gas for accumulate
  const gasTrans = BigInt.asUintN(64, s.registers[9]); // (m) – min gas for on-transfer

  const svc = env.getService(SVC_ID);
  console.log("upgradeHandler", { svc, off, gasAcc, gasTrans });
  if (!svc) return finish(s, WHO);
  
  // only 32-B code-hash, label <= 2^32 -1 
  const { bytes: hash, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!hash) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  const cBig = BigInt("0x" + Buffer.from(hash).reverse().toString("hex"));

  const updated: ServiceAccount = {
    ...svc,
    rootCodeHash: cBig,
    gasAccumulate: gasAcc,
    gasOnTransfer: gasTrans,
  };

  env.putService(SVC_ID, updated);
  return finish(s1, OK);
};