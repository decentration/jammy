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

  // config logic as a special case (protocol parameters, φ10 = 0)
  if (sel === FetchSel.Config) {
    const provided = env.fetchVector ? env.fetchVector("config" as any) : undefined;
    const v = provided ?? buildFetchConfigVector();
    return finishFetchLike(s, r, dest, offsetVector, lenReq, v, selName);
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

  // Conformance ABI (observed):
  // - Query call (lenReq == 0): return the total vector length in r7, preserve r6 sentinel.
  // - Copy call  (lenReq  > 0): clear r6 and return OK (0) in r7.
  if (lenReq > 0) r[6] = 0n;
  r[7] = lenReq === 0 ? BigInt(vLength) : OK;
  r[8] = 0n;
  return { state: { ...sOut, registers: r }, ok: true };
}
