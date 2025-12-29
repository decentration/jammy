import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { WHO, LOW, SVC_ID, CASH, OK, WT } from "../../consts";
import { finish } from "../../helpers";
import { AccEnv, AccumulateX, HostCallHandler, DeferredTransfer } from "../../types";
import { getMergedXs, getStagedOnly, stageAccount } from "./helpers";

// ΩT – transfer (selector 20)
// g = 10 + φ9 (Graypaper B.7)
// The transfer host call costs 10 gas + the gas limit (φ9/r9) for the on_transfer callback
export const transferHandler: HostCallHandler = (s, _id, env) => {
  const designIdx = Number(s.registers[7]);             // (d) – index into (xe).d
  const amount = BigInt.asUintN(64, s.registers[8]); // (a) – amount
  const gasLim = BigInt.asUintN(64, s.registers[9]); // (l) – gas limit for on_transfer
  const off = Number(s.registers[10]);            // (o) – ptr to memo (WT bytes)

  // Total cost: 10 (host call) + gasLim (for on_transfer callback)
  const totalGasCost = 10n + gasLim;

  if (BigInt(s.gas) < totalGasCost) {
    return { state: { ...s, exit: { type: ExitReasonType.OutOfGas } }, ok: true };
  }

  let sCharged = { ...s, gas: BigInt(s.gas) - totalGasCost };

  const { bytes: memo, state: sAfterRead } = readBytes(sCharged, off, WT);
  if (!memo) {
    return { state: { ...sCharged, exit: { type: ExitReasonType.Panic } }, ok: true };
  }
  sCharged = sAfterRead;

  // Resolve destination via designations table in (xe).d
  const designations: Map<number, bigint> | undefined = env.acc?.allocator?.env?.designations;
  if (!designations || !designations.has(Number(designIdx))) {
    return finish(sCharged, WHO); // unknown designation index
  }

  const destId = designations.get(designIdx);
  if (destId === undefined) return finish(sCharged, WHO);

  const dest = getStagedOnly(env, destId) ?? env.getService(destId);

  if (!dest) return finish(sCharged, WHO);

  if (gasLim < dest.gasOnTransfer) return finish(sCharged, LOW);

  const xe = env.acc.allocator.env as AccEnv;
  const xsId = xe.currentServiceId ?? SVC_ID;
  const xs = getMergedXs(env); // merged (staged over committed)
  if (!xs) return finish(sCharged, WHO);

  // CASH if a < (xs)t...
  const threshold = xs.threshold ?? 0n;     // (xs)t
  if (amount < threshold) return finish(sCharged, CASH);

  const newBal = xs.balance - amount;
  const existential = env.activationFee ?? 0n;
  if (newBal < existential) return finish(sCharged, CASH);

  xs.balance = newBal;
  stageAccount(env, xsId, { ...xs, balance: newBal });

  const ax = env.acc.allocator; // ax is AccumulateX
  ax.transfers ??= [];
  ax.transfers.push({
    from: xsId,
    to: destId,
    amount: amount,
    gasLimit: gasLim,
    memo: memo.slice(),
  });

  return finish(sCharged, OK);
};