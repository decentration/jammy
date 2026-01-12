import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { WHO, LOW, SVC_ID, CASH, OK, WT } from "../../consts";
import { finish } from "../../helpers";
import { AccEnv, AccumulateX, HostCallHandler, DeferredTransfer } from "../../types";
import { getMergedXs, getStagedOnly, stageAccount } from "./helpers";

// ΩT – transfer (selector 20)
// On failure (Panic, WHO, LOW, CASH), only charge base 10 gas.
// On success, charge 10 + gasLim (for on_transfer callback).
export const transferHandler: HostCallHandler = (s, _id, env) => {
  const designIdx = Number(s.registers[7]);             // (d) – index into (xe).d
  const amount = BigInt.asUintN(64, s.registers[8]); // (a) – amount
  const gasLim = BigInt.asUintN(64, s.registers[9]); // (l) – gas limit for on_transfer
  const off = Number(s.registers[10]);            // (o) – ptr to memo (WT bytes)

  const baseGas = 10n;
  const totalGasCost = baseGas + gasLim;

  // Check if we have enough gas for the full cost (in case success path)
  if (BigInt(s.gas) < totalGasCost) {
    return { state: { ...s, exit: { type: ExitReasonType.OutOfGas } }, ok: true };
  }

  // Charge only base gas initially - will charge gasLim on success
  let sCharged = { ...s, gas: BigInt(s.gas) - baseGas };

  const { bytes: memo, state: sAfterRead } = readBytes(sCharged, off, WT);
  if (!memo) {
    // Panic - only base gas charged
    return { state: { ...sCharged, exit: { type: ExitReasonType.Panic } }, ok: true };
  }
  sCharged = sAfterRead;

  // Resolve destination via designations table in (xe).d
  const designations: Map<number, bigint> | undefined = env.acc?.allocator?.env?.designations;
  if (!designations || !designations.has(Number(designIdx))) {
    // WHO - only base gas charged
    return finish(sCharged, WHO);
  }

  const destId = designations.get(designIdx);
  if (destId === undefined) return finish(sCharged, WHO);

  const dest = getStagedOnly(env, destId) ?? env.getService(destId);

  if (!dest) return finish(sCharged, WHO);

  if (gasLim < dest.gasOnTransfer) {
    // LOW - only base gas charged
    return finish(sCharged, LOW);
  }

  const xe = env.acc.allocator.env as AccEnv;
  const xsId = xe.currentServiceId ?? SVC_ID;
  const xs = getMergedXs(env); // merged (staged over committed)
  if (!xs) return finish(sCharged, WHO);

  // CASH if a < (xs)t...
  const threshold = xs.threshold ?? 0n;     // (xs)t
  if (amount < threshold) {
    // CASH - only base gas charged
    return finish(sCharged, CASH);
  }

  const newBal = xs.balance - amount;
  const existential = env.activationFee ?? 0n;
  if (newBal < existential) {
    // CASH - only base gas charged
    return finish(sCharged, CASH);
  }

  // Success path: charge the additional gasLim
  sCharged = { ...sCharged, gas: sCharged.gas - gasLim };

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