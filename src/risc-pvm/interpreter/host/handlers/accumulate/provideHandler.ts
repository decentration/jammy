import { hash } from "../../../../../utils/crypto";
import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { NONE, WHO, HUH, OK } from "../../consts";
import { finish } from "../../helpers";
import { AccumulateX, HostCallHandler, ServiceAccount } from "../../types";

// ΩP – provide (selector 26)
export const provideHandler: HostCallHandler = (s, _id, env) => {
  const sel  = BigInt.asUintN(64, s.registers[7]); // service selector: NONE -> xs else explicit id
  const off  = Number(s.registers[8]);             // (o)
  const len  = Number(s.registers[9]);             // z

  const { bytes: i, state: s1 } = readBytes(s, off, len);
  if (!i) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  const xsId = env.acc?.allocator?.env?.currentServiceId;
  const sId  = (sel === NONE) ? xsId : sel;
  if (sId === undefined) return finish(s1, WHO);

  // a = (xe).d[s]  staged only
  const staged = env.acc?.allocator?.env?.deltas;
  const a = staged?.get(sId) as ServiceAccount | undefined;
  if (!a) return finish(s1, WHO);

  // check ledger: al[(H(i), z)] must be [] (empty solicitation)
  const h = hash(i);
  const hHex = Buffer.from(h).toString("hex");

  const inner = a.ledger?.get(hHex);
  const entry = inner?.get(len);

  if (!entry || entry.length !== 0) return finish(s1, HUH);

  // (s, i) within in xp must be unique
  const ax = env.acc.allocator as AccumulateX;
  ax.provides ??= [] as Array<{ s: bigint; i: Uint8Array }>;
  ax.providesSeen ??= new Map<bigint, Set<string>>();

  const iHex = Buffer.from(i).toString("hex");
  let seenForS = ax.providesSeen.get(sId);
  if (!seenForS) {
    seenForS = new Set<string>();
    ax.providesSeen.set(sId, seenForS);
  }
  if (seenForS.has(iHex)) return finish(s1, HUH);

  seenForS.add(iHex);
  ax.provides.push({ s: sId, i: i.slice() });

  return finish(s1, OK);
};
