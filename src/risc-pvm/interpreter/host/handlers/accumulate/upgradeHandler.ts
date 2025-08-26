import { fromLE, readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import {  HASH_BYTES, OK, SVC_ID } from "../../consts";
import { finish } from "../../helpers";
import { HostEnvInterface } from "../../hostEnvInterface";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getOverlayChangeSet, stageAccount } from "./helpers";

const u256FromLE = (u8: Uint8Array): bigint => {
  let v = 0n;
  for (let i = 0; i < u8.length; i++) {
    v |= BigInt(u8[i]) << (8n * BigInt(i));
  }
  return v;
};

const zeroService = (): ServiceAccount => ({
  storage: new Map(), preimages: new Map(), lookupStorage: new Map(),
  rootCodeHash: 0n, balance: 0n, gasAccumulate: 0n, gasOnTransfer: 0n,
  cores: new Uint8Array(0), selectorMap: new Map(),
  ticketNext: 0n, coresOffset: 0, ticketIndex: 0,
});


// ΩU – updgrade (selector 19)
export const upgradeHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]);                   // (o) – offset pointer to 32-byte code-hash
  const gasAcc = BigInt.asUintN(64, s.registers[8]);    // (g) – min gas for accumulate
  const gasTrans = BigInt.asUintN(64, s.registers[9]);  // (m) – min gas for on-transfer

  const curId = env.acc?.allocator?.env?.currentServiceId ?? SVC_ID;
  const cur   = getOverlayChangeSet(env, curId) ?? zeroService();
  
  // only 32-B code-hash, label <= 2^32 -1 
  const { bytes: hash, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!hash) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  const cBig = u256FromLE(hash);

  const updated: ServiceAccount = {
    ...cur,
    rootCodeHash: cBig,
    gasAccumulate: gasAcc,
    gasOnTransfer: gasTrans,
  };

  console.log("UPGRADE", cur, updated);
  stageAccount(env, curId, updated);

  return finish(s1, OK);
};

