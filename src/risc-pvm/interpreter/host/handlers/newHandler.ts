import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { ACTIVATION_FEE, CASH, CORES_SIZE, FULL, HASH_BYTES, HUH, MAX_LABEL, SVC_ID } from "../consts";
import { checkAlloc, finish, nextIdInRing, RING_START } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";


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

  // xs – current payer - allow either currentServiceId (xe.m) or SVC_ID fallback
  const payerId = env.acc?.allocator?.env?.currentServiceId ?? SVC_ID;

  // enforce: if f != 0 then payer must match currentServiceId
  if (flags !== 0n && env.acc.allocator.env.currentServiceId !== undefined && payerId !== env.acc.allocator.env.currentServiceId)
  return finish(s1, HUH);

  // otherwise if sb < (xs)t
  // payer xs from accumulate session
  // const payer = env.getService(payerId);
  // // funds check
  // if (!payer || payer.balance < ACTIVATION_FEE) return finish(s1, CASH);


  // build new account - (a)
  const payer: ServiceAccount = env.getService(payerId) ?? {
    storage:       new Map(),
    preimages:     new Map(),
    lookupStorage: new Map(),
    rootCodeHash:  BigInt("0x"+Buffer.from(hash).reverse().toString("hex")),
    balance:       ACTIVATION_FEE, // initial balance is activation fee
    gasAccumulate: gasAcc,
    gasOnTransfer: gasTrans,
    cores:         new Uint8Array(CORES_SIZE),
    selectorMap:   new Map(),
    ticketNext:    0n,
    coresOffset:   0,
    ticketIndex:   0,
  };

  const postDebit = payer.balance - ACTIVATION_FEE;

  // (xs)t : use explicit field if you add one later; until then fall back to env.activationFee (≥ 0)
  const threshold = (payer as any).threshold ?? (env as any).activationFee ?? 0n;

  // otherwise if sb < (xs)t  -> CASH
  if (postDebit < threshold) return finish(s1, CASH);

  const account: ServiceAccount = {
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

  const sDebited: ServiceAccount = { ...payer, balance: postDebit };

  const clKey = (() => {  //(c, l) key for lookup storage
    const key = new Uint8Array(32 + 4);
    key.set(hash, 0); // as read from memory
    key[32] = Number(labelBE & 0xffn); // label low byte
    key[33] = Number((labelBE >> 8n) & 0xffn); //  mid byte
    key[34] = Number((labelBE >> 16n) & 0xffn); // high byte
    key[35] = Number((labelBE >> 24n) & 0xffn); // top byte
    return Buffer.from(key).toString("hex");
  })();
  account.lookupStorage.set(clKey, new Uint8Array(0));

  // branch: explicit candidate allowed only if xs == (xe)r and explicitIdx < S
  const isRoot = (env.acc.allocator.env.root !== undefined) && (payerId === env.acc.allocator.env.root);
  if (isRoot && explicitIdx < RING_START) {
    // if already staged at explicitIdx => FULL
    if (env.acc.allocator.env.deltas.has(explicitIdx) || env.hasService?.(explicitIdx)) {// add last part for if explicitIdx is already used
      return finish(s1, FULL);
    }

    // stage deltas
    env.acc.allocator.env.deltas.set(explicitIdx, account);
    env.acc.allocator.env.deltas.set(payerId, sDebited);

    // !TODO apply immediately to env for now but will be applied later stage of the pipeline.
    env.putService(payerId, sDebited);
    env.putService(explicitIdx, account);

    return finish(s1, explicitIdx);
  }

  // id allocator (ring)
  let cursor = env.acc.allocator.index;
  // pick candidate per ring, run check, persist cursor
  let candidate = checkAlloc(nextIdInRing(cursor));
  env.acc.allocator.index = candidate;

  // advance until free id (staged or committed)
  while (env.acc.allocator.env.deltas.has(candidate) || env.hasService?.(candidate)) {
  candidate = checkAlloc(nextIdInRing(candidate));
  env.acc.allocator.index = candidate;
}

  // stage deltas
  env.acc.allocator.env.deltas.set(candidate, account);
  env.acc.allocator.env.deltas.set(payerId, sDebited);

  // debit fee from sender and store both accounts
  // !TODO: apply immeidately for now... end of block integration step in pipeline required. 
  // We stage into (xe).d (spec-correct), but also mirror to the committed store
  // so other handlers/tests can observe the new state immediately.
  // In a real pipeline, only (xe).d should be mutated here and commit happens
  // at end-of-block; remove/guard the puts below when that is wired up.
  env.putService(payerId, sDebited);
  env.putService(candidate, account);

  return finish(s1, candidate);

};
