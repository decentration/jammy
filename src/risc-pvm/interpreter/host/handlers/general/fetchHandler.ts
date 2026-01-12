import { writeBytes } from "../../../instructions/helpers";
import { ExitReasonType } from "../../../types";
import { OK, WHAT, NONE } from "../../consts";
import { buildFetchConfigVector } from "../../helpers";
import { FetchSel, fetchVecSelectorMap, HostCallHandler } from "../../types";

// Fetch selector names for logging
const FETCH_SEL_NAMES: Record<number, string> = {
  [FetchSel.Config]: "Config",
  [FetchSel.Params]: "Params",
  [FetchSel.Returns]: "Returns",
  [FetchSel.ImportsElem]: "ImportsElem",
  [FetchSel.ImportsList]: "ImportsList",
  [FetchSel.WorkItemsElem]: "WorkItemsElem",
  [FetchSel.WorkItemsList]: "WorkItemsList",
  [FetchSel.ProgSerialized]: "ProgSerialized",
  [FetchSel.ProgMeta]: "ProgMeta",
  [FetchSel.ProgJ]: "ProgJ",
  [FetchSel.ProgX]: "ProgX",
  [FetchSel.ProgWords]: "ProgWords",
  [FetchSel.ProgWordLen]: "ProgWordLen",
  [FetchSel.ProgWordField]: "ProgWordField",
  [FetchSel.AuthTraceSer]: "AuthTraceSer",
  [FetchSel.AuthTraceElem]: "AuthTraceElem",
};

// ΩY  – selector 1  --
export const fetchHandler: HostCallHandler = (s, _id, env) => {

  // registers on entry (spec B.6):
  // register 7  – o: destination offset in inner‑VM memory (also overwritten with result)
  // register 8  – f: offset into the vector
  // register 9  – l: length requested (0 means "copy 0 bytes"; query-only is achieved by l=0)
  // register 10 – n: selector (which vector)
  //
  // Conformance service ABI (based on observed Rust test-service behavior):
  // - On success: r7 <- OK (0), r8 <- |v| (total vector length)
  // - If v is unavailable: r7 <- NONE
  // - If the requested write range is invalid: the VM panics (☇)
  //
  // NOTE: This differs from Graypaper B.5 literal interpretation where r7 was the length.
  const dest = Number(s.registers[7]);
  const offsetVector = Number(s.registers[8]);
  const lenReq = Number(s.registers[9]);
  const sel = Number(s.registers[10]);
  const r = s.registers.slice();

  const selName = FETCH_SEL_NAMES[sel] ?? `unknown(${sel})`;
  if (process.env.JAM_DEBUG_HOST === "1") {
    console.log(`[fetch] sel=${sel} (${selName}) dest=0x${dest.toString(16)} offset=${offsetVector} lenReq=${lenReq}`);
  }

  // config logic as a special case (protocol parameters) now also returns config blob
  if (sel === FetchSel.Config || sel === FetchSel.ProgMeta) {
    const provided = env.fetchVector ? env.fetchVector("config" as any) : undefined;
    const v = provided ?? buildFetchConfigVector();
    return finishFetchLike(s, r, dest, offsetVector, lenReq, v, selName);
  }

  // B.5 Selector 5
  if (sel === FetchSel.WorkItemsElem) {
    const idx1 = Number(s.registers[11]); //work item index
    const idx2 = Number(s.registers[12]); // field index within work item
    const items = env.workItemsList;

    if (process.env.JAM_DEBUG_HOST === "1") {
      console.log(`[fetch:sel5] idx1=${idx1} idx2=${idx2} itemsLen=${items?.length ?? 0}`);
    }

    if (!items || idx1 >= items.length) {
      r[7] = NONE;
      return { state: { ...s, registers: r }, ok: true };
    }
    const workItem = items[idx1];
    if (!workItem || idx2 >= workItem.length) {
      r[7] = NONE;
      return { state: { ...s, registers: r }, ok: true };
    }
    const v = workItem[idx2];
    return finishFetchLike(s, r, dest, offsetVector, lenReq, v, `WorkItemsElem[${idx1}][${idx2}]`);
  }

  // B.5 Selector 6
  if (sel === FetchSel.WorkItemsList) {
    const idx1 = Number(s.registers[11]); // field index within current work item
    const currentIdx = env.currentWorkItemIndex ?? 0;
    const items = env.workItemsList;

    if (process.env.JAM_DEBUG_HOST === "1") {
      console.log(`[fetch:sel6] currentIdx=${currentIdx} idx1=${idx1} itemsLen=${items?.length ?? 0}`);
    }

    if (!items || currentIdx >= items.length) {
      r[7] = NONE;
      return { state: { ...s, registers: r }, ok: true };
    }
    const workItem = items[currentIdx];
    if (!workItem || idx1 >= workItem.length) {
      r[7] = NONE;
      return { state: { ...s, registers: r }, ok: true };
    }
    const v = workItem[idx1];
    return finishFetchLike(s, r, dest, offsetVector, lenReq, v, `WorkItemsList[${currentIdx}][${idx1}]`);
  }

  const vecName = fetchVecSelectorMap[sel];
  if (!vecName) {
    if (process.env.JAM_DEBUG_HOST === "1") {
      console.log(`[fetch] FAIL: unknown selector ${sel} -> NONE`);
    }
    r[7] = NONE;
    r[8] = 0n;
    return { state: { ...s, registers: r }, ok: true };
  }

  const vec = env.fetchVector(vecName);
  if (!vec) {
    if (process.env.JAM_DEBUG_HOST === "1") {
      console.log(`[fetch] FAIL: vector '${vecName}' not found in env -> NONE`);
    }
    r[7] = NONE;
    r[8] = 0n;
    return { state: { ...s, registers: r }, ok: true };
  }

  return finishFetchLike(s, r, dest, offsetVector, lenReq, vec, vecName);
};

function finishFetchLike(
  s: Parameters<HostCallHandler>[0],
  r: bigint[],
  dest: number,
  offsetVector: number,
  lenReq: number,
  vec: Uint8Array,
  label: string,
) {
  const vLength = vec.length;
  const f = Math.min(offsetVector, vLength);
  const l = Math.min(Math.max(lenReq, 0), vLength - f);

  if (process.env.JAM_DEBUG_HOST === "1") {
    const head = Array.from(vec.slice(0, Math.min(32, vec.length)));
    console.log(`[fetch:${label}] vLength=${vLength} f=${f} l=${l} dest=0x${dest.toString(16)} head32=[${head.join(",")}]`);
  }

  // Per Graypaper B.5: On success r7 = |v| (vector length).
  // If l > 0 we must also copy vf⋅⋅⋅+l into inner memory at µo⋅⋅⋅+l.
  let sOut = s;
  if (l > 0) {
    const s1 = writeBytes(s, dest, vec.subarray(f, f + l));
    const errType = s1.exit?.type;
    if (errType === ExitReasonType.PageFault || errType === ExitReasonType.Panic) {
      if (process.env.JAM_DEBUG_HOST === "1") {
        console.log(`[fetch:${label}] FAIL: writeBytes error (${ExitReasonType[errType]}) -> Panic`);
      }
      return {
        state: { ...s, exit: { type: ExitReasonType.Panic } },
        ok: true,
      };
    }
    sOut = s1;
  }

  // Per Graypaper B.5 and previous session analysis:
  // - r7 = |v| (vector length)  
  // - r6 MUST be preserved (not modified), the service checks:
  //   branch_ge_u r7, r6 → with r6=NONE (2^64-1), r7 < r6 = success path
  //   If we set r6=OK (0), then r7 >= r6 = error path (causes panic)
  r[7] = BigInt(vLength);
  return { state: { ...sOut, registers: r }, ok: true };
}
