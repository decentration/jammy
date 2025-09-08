import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { ACTIVATION_FEE, CASH, CORES_SIZE, FULL, HASH_BYTES, HUH, MAX_LABEL, SVC_ID, WHO } from "../../consts";
import { checkAlloc, finish, nextIdInRing, RING_START, zeroService } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";
import { getMergedXs, stageAccount } from "./helpers";


// ΩN – new (selector 9)
export const newHandler: HostCallHandler = (s, _id, env) => {
  const off =          Number(s.registers[7]);                // (o) – offset pointer to 32-byte code-hash
  const labelBE =      BigInt.asUintN(64, s.registers[8]);    // (l) – 2^32-bit label (taking low 64)
  const gasAcc =       BigInt.asUintN(64, s.registers[9]);    // (g) – min gas for accumulate
  const gasTrans =     BigInt.asUintN(64, s.registers[10]);   // (m) – min gas for on-transfer
  const flags =        BigInt.asUintN(64, s.registers[11]);   // (f) – flags 
  const explicitIdx =  BigInt.asUintN(64, s.registers[12]);   // (i) – candidate index in ring

  // code-hash and label checks
  const { bytes: hash, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!hash || labelBE > MAX_LABEL) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // xs – current payer - allow either currentServiceId (xe.m) no need for SVC_ID fallback
  const xsId = env.acc!.allocator!.env!.currentServiceId; // xs

  // enforce: if f != 0 then payer must match currentServiceId
  if (flags !== 0n && env.acc.allocator.env.currentServiceId !== undefined && xsId !== env.acc.allocator.env.currentServiceId)
  return finish(s1, HUH);

  // If flags != 0 then payer must be exactly (xe).m per spec (privileged path)
  if (flags !== 0n &&
    env.acc?.allocator?.env?.currentServiceId !== undefined &&
    xsId !== env.acc.allocator.env.currentServiceId) {
      return finish(s1, HUH);
  }

  // otherwise if sb < (xs)t
  // payer xs from accumulate session
  // const payer = env.getService(payerId);
  // // funds check
  // if (!payer || payer.balance < ACTIVATION_FEE) return finish(s1, CASH);


  // Effective xs (merged staged-over-committed); if truly missing, treat as zero
  const xs0 = getMergedXs(env) ?? zeroService();
  

  const postDebit = xs0.balance - ACTIVATION_FEE;

  // (xs)t : use explicit field if you add one later; until then fall back to env.activationFee (≥ 0)
  const threshold = xs0.threshold ?? (env as any).activationFee ?? 0n;

  // otherwise if sb < (xs)t  -> CASH
  if (postDebit < threshold) return finish(s1, CASH);

  const newAccount: ServiceAccount = {
    storage:       new Map(),
    preimages:     new Map(),
    lookupStorage: new Map(),
    rootCodeHash:  BigInt("0x" + Buffer.from(hash).reverse().toString("hex")),
    balance:       ACTIVATION_FEE,           // initial balance = at
    gasAccumulate: gasAcc,
    gasOnTransfer: gasTrans,
    cores:         new Uint8Array(CORES_SIZE),
    selectorMap:   new Map(),
    ticketNext:    0n,
    coresOffset:   0,
    ticketIndex:   0,
  };


 {  //(c, l) key for lookup storage
    const key = new Uint8Array(32 + 4);
    key.set(hash, 0); // as read from memory
    key[32] = Number(labelBE & 0xffn); // label low byte
    key[33] = Number((labelBE >> 8n) & 0xffn); //  mid byte
    key[34] = Number((labelBE >> 16n) & 0xffn); // high byte
    key[35] = Number((labelBE >> 24n) & 0xffn); // top byte
    const clKey = Buffer.from(key).toString("hex");
    newAccount.lookupStorage.set(clKey, new Uint8Array(0));
  }

  const debitedXs: ServiceAccount = { ...xs0, balance: postDebit };
  const xe = env.acc.allocator.env;

  // branch: explicit candidate allowed only if xs == (xe)r and explicitIdx < S
  const isRoot = (xe.root !== undefined) && (xsId === xe.root);
  if (isRoot && explicitIdx < RING_START) {
    const xe = env.acc.allocator.env;
    const taken =
      xe.deltas.has(explicitIdx) ||
      (env.hasService?.(explicitIdx) ?? false) ||
      xe.deleted?.has?.(explicitIdx);
    // if already staged at explicitIdx => FULL
    if (taken) {// add last part for if explicitIdx is already used
      return finish(s1, FULL);
    }

    // stage deltas
    stageAccount(env, explicitIdx, newAccount);
    stageAccount(env, xsId, debitedXs);   

    return finish(s1, explicitIdx);
  }

  // id allocator (ring)
  let cursor = env.acc.allocator.index;
  // pick candidate per ring, run check, persist cursor
  let candidate = checkAlloc(env,nextIdInRing(cursor));
  env.acc.allocator.index = candidate;


  // stage deltas
  stageAccount(env, candidate, newAccount);
  if (xsId !== undefined) stageAccount(env, xsId, debitedXs);

  return finish(s1, candidate);

};
