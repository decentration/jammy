import { readBytes } from "../../instructions/helpers";
import { ExitReasonType } from "../../types";
import { WHO, LOW, SVC_ID, CASH, OK, WT } from "../consts";
import { finish } from "../helpers";
import { HostCallHandler } from "../types";

// ΩT – transfer (selector 20)
// g = 10 + w9
export const transferHandler: HostCallHandler = (s, _id, env) => {
  const destId = s.registers[7];          // (d) – dest id
  const amount = BigInt.asUintN(64, s.registers[8]); // (a) – amount
  const gasLim = BigInt.asUintN(64, s.registers[9]); // (l) – gas limit for on_transfer
  const off = Number(s.registers[10]);               // (o) – ptr to memo (WT bytes)


  if (BigInt(s.gas) < gasLim) {
    return { state: { ...s, exit: { type: ExitReasonType.OutOfGas } }, ok: true };
  }
  // safe: Number(gasLim) ≤ s.gas ≤ 2^53-1
  let sCharged = { ...s, gas: s.gas - Number(gasLim) };

  const { bytes: memo, state: s1 } = readBytes(sCharged, off, WT);
  if (!memo) {
    return { state: { ...sCharged, exit: { type: ExitReasonType.Panic } }, ok: true };
  }
  sCharged = s1;


  const dest = env.getService(destId);
  if (!dest) {
    return finish(sCharged, WHO);
  }

  if (gasLim < dest.gasOnTransfer) return finish(s1, LOW);

  const payerId = env.acc.allocator.env.currentServiceId ?? SVC_ID;
  const sender = env.getService(payerId);
  if (!sender) return finish(s1, WHO);

  // spec says: CASH if a < (xs)t — we use sender.threshold or env.activationFee as a stop-gap until we model xs.t explicitly
  const threshold = (sender as any).threshold ?? (env as any).activationFee ?? 0n;
  if (amount < threshold) {
    return finish(sCharged, CASH);
  }

  const newBal = sender.balance - amount;
  const existential = (env as any).activationFee ?? 0n; 
  if (newBal < existential) return finish(s1, CASH);

  sender.balance = newBal;
  env.putService(payerId, sender);

  (env.acc.allocator.env.deltas as any).transfers ??= [];
  (env.acc.allocator.env.deltas as any).transfers.push({
    from: payerId,
    to: destId,
    amount: amount,
    gasLimit: gasLim,
    memo: memo.slice(),
  });

  return finish(s1, OK);
};