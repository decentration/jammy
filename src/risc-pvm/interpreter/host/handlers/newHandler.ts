import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { ACTIVATION_FEE, CASH, CORES_SIZE, HASH_BYTES, MAX_LABEL } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler, ServiceAccount } from "../types";


// ΩN – new (selector 9)
export const newHandler: HostCallHandler = (s, _id, env) => {
  const off = Number(s.registers[7]);      // (o) – offset pointer to 32-byte code-hash
  const label = BigInt.asUintN(64, s.registers[8]); // (l) – 2^32-bit label (taking low 64)
  const gasAcc = BigInt.asUintN(64, s.registers[9]); // (g) – min gas for accumulate
  const gasTrans = BigInt.asUintN(64, s.registers[10]); // (m) – min gas for on-transfer

  // only 32-B code-hash, label <= 2^32 -1 
  const { bytes: hash, state: s1 } = readBytes(s, off, HASH_BYTES);
  if (!hash || label > MAX_LABEL) return { state:{ ...s, exit:{ type: ExitReasonType.Panic } }, ok:true };

  // !TODO stib - sender (“xs”) is the special scratch account for now
  const senderId = 0xffff_ffff_ffff_ffffn;
  const sender = env.getService(senderId);
  if (!sender || sender.balance < ACTIVATION_FEE) // not enough cash
    return finish(s1, CASH);

  // !TODO - stub - find first unused id (spec compliance will require a ring allocator)
  let id = 0n; 
  while (env.hasService?.(id)) ++id;

  // build fresh account “a”
  const service: ServiceAccount = {
    storage:new Map(),
    preimages:new Map(),
    lookupStorage: new Map(),
    rootCodeHash: BigInt("0x"+Buffer.from(hash).reverse().toString("hex")),
    balance: 0n,
    gasAccumulate: gasAcc,
    gasOnTransfer: gasTrans,
    cores: new Uint8Array(CORES_SIZE),
    selectorMap:new Map(),
    ticketNext: 0n,
    coresOffset: 0,
    ticketIndex: 0,
  };

  // debit fee from sender and store both accounts
  sender.balance -= ACTIVATION_FEE;
  env.putService(senderId, sender);
  env.putService(id, service);


  return finish(s1, id)   
};
