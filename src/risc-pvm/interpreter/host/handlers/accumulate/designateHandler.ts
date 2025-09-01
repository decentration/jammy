import { readBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { SVC_ID, OK, PAYLOAD_BYTES, HUH } from "../../consts";
import { decodeDesignationsVector, finish } from "../../helpers";
import { HostCallHandler, ServiceAccount } from "../../types";


// ΩD – designate (selector 7)
export const designateHandler: HostCallHandler = (s, _id, env) => {
  const srcPtr = Number(s.registers[7]); // (o)

  const { bytes, state: s1 } = readBytes(s, srcPtr, PAYLOAD_BYTES);
  if (!bytes) return { state: { ...s, exit: { type: ExitReasonType.Panic } }, ok: true };

  const parsed = decodeDesignationsVector(bytes);
  if (!parsed) return finish(s1, HUH);

  const xe = env.acc?.allocator?.env!;

  xe.designationsRaw = bytes.slice();
  xe.designations = parsed.designations;
  xe.designationEntries = parsed.entries;


  return finish(s1, OK);
};