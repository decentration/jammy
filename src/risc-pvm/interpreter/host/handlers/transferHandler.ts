import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { WHO, LOW, SVC_ID, CASH, OK, WT } from "../consts";
import { finish } from "../helpers";
import { AccEnv, AccumulateX, HostCallHandler, DeferredTransfer } from "../types";

// ΩT – transfer (selector 20)
// g = 10 + w9
export const transferHandler: HostCallHandler = (s, _id, env) => {
  const deltaIdx = Number(s.registers[7]);             // (d) – index into (xe).d
  const amount =   BigInt.asUintN(64, s.registers[8]); // (a) – amount
  const gasLim =   BigInt.asUintN(64, s.registers[9]); // (l) – gas limit for on_transfer
  const off =      Number(s.registers[10]);            // (o) – ptr to memo (WT bytes)


  if (BigInt(s.gas) < gasLim) {
    return { state: { ...s, exit: { type: ExitReasonType.OutOfGas } }, ok: true };
  }
  // safe: Number(gasLim) ≤ s.gas ≤ 2^53-1
  let sCharged = { ...s, gas: s.gas - Number(gasLim) };

  const { bytes: memo, state: sAfterRead } = readBytes(sCharged, off, WT);
  if (!memo) {
    return { state: { ...sCharged, exit: { type: ExitReasonType.Panic } }, ok: true };
  }
  sCharged = sAfterRead;

  // Resolve destination via designations table in (xe).d
  const designations: Map<number, bigint> | undefined = env.acc?.allocator?.env?.designations;
  if (!designations || !designations.has(Number(deltaIdx))) {
    return finish(sCharged, WHO); // unknown designation index
  }

  const destId = designations.get(deltaIdx);
  if (destId === undefined) return finish(sCharged, WHO);
  

  const dest = env.getService(destId);
  if (!dest) {
    return finish(sCharged, WHO);
  }

  if (gasLim < dest.gasOnTransfer) return finish(sCharged, LOW);

  const payerId = env.acc.allocator.env.currentServiceId ?? SVC_ID;
  const sender = env.getService(payerId);
  if (!sender) return finish(sCharged, WHO);

  // CASH if a < (xs)t...
  const threshold = sender.threshold ?? 0n;     // (xs)t
  if (amount < threshold) return finish(sCharged, CASH);
  
  const newBal = sender.balance - amount;
  const existential = env.activationFee ?? 0n; 
  if (newBal < existential) return finish(sCharged, CASH);

  sender.balance = newBal;
  env.putService(payerId, sender);

  const ax = env.acc.allocator; // ax is AccumulateX
  ax.transfers ??= [];
  ax.transfers.push({
    from: payerId,
    to: destId,
    amount: amount, 
    gasLimit: gasLim, 
    memo: memo.slice(), 
  });

  return finish(sCharged, OK);
};