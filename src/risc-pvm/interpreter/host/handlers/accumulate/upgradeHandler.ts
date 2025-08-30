import { fromLE, readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import {  HASH_BYTES, OK, SVC_ID } from "../../consts";
import { finish, zeroService } from "../../helpers";
import { HostEnvInterface } from "../../hostEnvInterface";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getMergedXs, stageAccount } from "./helpers";

const u256FromLE = (u8: Uint8Array): bigint => {
  let v = 0n;
  for (let i = 0; i < u8.length; i++) {
    v |= BigInt(u8[i]) << (8n * BigInt(i));
  }
  return v;
};


// ΩU – updgrade (selector 19)
export const upgradeHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]);                   // (o) – offset pointer to 32-byte code-hash
  const gasAcc = BigInt.asUintN(64, s.registers[8]);    // (g) – min gas for accumulate
  const gasTrans = BigInt.asUintN(64, s.registers[9]);  // (m) – min gas for on-transfer

  const xsId = env.acc?.allocator?.env?.currentServiceId ?? SVC_ID;
  
  // only 32-B code-hash, label <= 2^32 -1 
  const { bytes: hash, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!hash) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  const cBig = u256FromLE(hash);

  // effective xs view (staged-over-committed); create zeroed if missing
  const xs = getMergedXs(env) ?? zeroService();

  const updated: ServiceAccount = {
    ...xs,
    rootCodeHash: cBig,
    gasAccumulate: gasAcc,
    gasOnTransfer: gasTrans,
  };

  stageAccount(env, xsId, updated);

  return finish(s1, OK);
};

