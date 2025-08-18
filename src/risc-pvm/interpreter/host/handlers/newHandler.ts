import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { ACTIVATION_FEE, CASH, CORES_SIZE, FULL, HASH_BYTES, HUH, MAX_LABEL } from "../consts";
import { checkAlloc, finish, nextIdInRing, RING_START } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";


// ΩN – new (selector 9)
export const newHandler: HostCallHandler = (s, _id, env) => {
  const off =                  Number(s.registers[7]);    // (o) – offset pointer to 32-byte code-hash
  const labelBE =  BigInt.asUintN(64, s.registers[8]);    // (l) – 2^32-bit label (taking low 64)
  const gasAcc =   BigInt.asUintN(64, s.registers[9]);    // (g) – min gas for accumulate
  const gasTrans = BigInt.asUintN(64, s.registers[10]);   // (m) – min gas for on-transfer
  const f =        BigInt.asUintN(64, s.registers[11]); // (f) – flags 
  const iInRing =        BigInt.asUintN(64, s.registers[12]); // (i) – index in ring

  // code-hash and label checks
  const { bytes: hash, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!hash || labelBE > MAX_LABEL) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // xs – current payer - allow either currentServiceId (xe.m) or SENDER fallback
  const payerId = env.acc?.allocator?.env?.currentServiceId ?? 0xffff_ffff_ffff_ffffn;

  // enforce: if f != 0 then payer must match currentServiceId
  if (f !== 0n && env.acc.allocator.env.currentServiceId !== undefined && payerId !== env.acc.allocator.env.currentServiceId)
  return finish(s1, HUH);

  // payer xs from accumulate session
  const payer = env.getService(payerId);
  // funds check
  if (!payer || payer.balance < ACTIVATION_FEE) return finish(s1, CASH);


  // build new account - (a)
  const account: ServiceAccount = {
    storage:new Map(),
    preimages:new Map(),
    lookupStorage: new Map(),
    rootCodeHash: BigInt("0x"+Buffer.from(hash).reverse().toString("hex")),
    balance: ACTIVATION_FEE, // initial balance is activation fee
    gasAccumulate: gasAcc,
    gasOnTransfer: gasTrans,
    cores: new Uint8Array(CORES_SIZE),
    selectorMap:new Map(),
    ticketNext: 0n,
    coresOffset: 0,
    ticketIndex: 0,
  };

  const sDebited: ServiceAccount = { ...payer, balance: payer.balance - ACTIVATION_FEE };

  // branch: explicit candidate allowed only if xs == (xe)r and iInRing < S
  const isRoot = (env.acc.allocator.env.root !== undefined) && (payerId === env.acc.allocator.env.root);
  if (isRoot && iInRing < RING_START) {
    // if already staged at iInRing => FULL
    if (env.acc.allocator.env.deltas.has(iInRing)) return finish(s1, FULL);

    // stage deltas
    env.acc.allocator.env.deltas.set(iInRing, account);
    env.acc.allocator.env.deltas.set(payerId, sDebited);

    // !TODO apply immediately to env for now but will be applied later stage of the pipeline.
    env.putService(payerId, sDebited);
    env.putService(iInRing, account);

    return finish(s1, iInRing);
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

  // debit fee from sender and store both accounts
  // !TODO: apply immeidately for now... end of block integration step in pipeline required. 
  env.putService(payerId, sDebited);
  env.putService(candidate, account);

  return finish(s1, candidate);

};
