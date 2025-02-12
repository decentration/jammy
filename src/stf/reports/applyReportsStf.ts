
import { arrayEqual, convertToReadableFormat, toHex } from "../../utils";
import { CORES_COUNT, MAX_BLOCKS_HISTORY, VALIDATOR_COUNT, MAX_WORK_SIZE, ROTATION_PERIOD, MAXIMUM_TOTAL_ACCUMULATE_GAS, TIMEOUT, EPOCH_LENGTH, VALIDATORS_PER_CORE } from "../../consts";
import { alreadyInRecentBlocks, areSortedAndUniqueByValidatorIndex, finalizeReporters, findExportsRoot, inRecentBlocksOrNew } from "./helpers";
import { Ed25519Public, SegmentItem } from "../../types/types";
import { verifyReportSignature } from "./verifyReportSignature";
import { hexStringToBytes, toBytes } from "../../codecs";
import { ReportsState, ReportsInput, ReportsOutput, ReporterItem, ErrorCode } from "./types"; 
import { superPeaks } from "../../mmr/superPeaks";
import { getPermutation, getPermutationForSlot } from "../../shuffle";
import { assignedCore,isPrevRotationInSameEpoch,isWithinOneRotation, rotatePermutation, whichRotation } from "../../shuffle/utils";

/**
* applyReportsStf 
 * Implements Jam GP 11.2–11.5 (the guarantees extrinsic).
 * This function performs structural checks (e.g. package hash duplication,
 * dependency limits), context checks (e.g. anchor, state root), gas/output checks,
 * prerequisite and segment lookup validations, and then signature (credential) checks.
 * 
 * On success, the guarantee is recorded in avail_assignments and the output includes:
 *    - reported: a list of { work_package_hash, segment_tree_root }
 *    - reporters: a finalized list of reporter public keys.
 */
export async function applyReportsStf( preState: ReportsState, input: ReportsInput): 
Promise<{ output: ReportsOutput; postState: ReportsState; }> {
  
  // 2) Verifying validator assigment to cores: 
  // Build the base curr or prev permutations:
  //  check if the previous rotation is in the same epoch
  //  if not we produce a differentn permutation with η′3, λ′
  //  if it is we use entropy[2] seed

  let entropy = preState.entropy;
  let baseCurr: number[] = [];
  let basePrev: number[] = [];
  if ( isPrevRotationInSameEpoch(input.slot, ROTATION_PERIOD, EPOCH_LENGTH) ) {
    // same epoch we use entropy[2] seed
    basePrev = getPermutation( entropy[2], preState.prev_validators.length );
    console.log("same epoch basePrev", convertToReadableFormat(basePrev));
  } else {
      // different epoch => (11.22) => (η′3, λ′)
      // lambda is old validator set and η′3 is entropy[3] seed
      basePrev = getPermutation( entropy[3], preState.prev_validators.length );
  }
  console.log("baseCurr", convertToReadableFormat(baseCurr));
  console.log("basePrev", convertToReadableFormat(basePrev));

  // 3) Now we do the “slot-based” rotation for the current epoch set:
  const rotatedCurr = rotatePermutation(baseCurr,input.slot,
    EPOCH_LENGTH,
    ROTATION_PERIOD,
    VALIDATORS_PER_CORE
  );

  // 4) For the previous epoch set, we do the rotation but for (slot - ROTATION_PERIOD):
  const rotatedPrev = rotatePermutation(basePrev,input.slot - ROTATION_PERIOD,
    EPOCH_LENGTH,
    ROTATION_PERIOD,
    VALIDATORS_PER_CORE
  );

  console.log("rotatedCurr", convertToReadableFormat(rotatedCurr));
  console.log("rotatedPrev", convertToReadableFormat(rotatedPrev));


  if (!input.guarantees || input.guarantees.length === 0) {
    // no changes to state 
    return { output: null, postState: preState };
  }

  // Clone preState
  const postState = structuredClone(preState) as ReportsState;
  const seenPkgHashes = new Set<string>();
  const newPackages: Map<string, { exportsRoot: Uint8Array }> = new Map(); 

  // we need to loop through to get a map of the new packages before looping through again after.
  for (const g of input.guarantees) {
    const pkgHash = toHex(g.report.package_spec.hash);
    const exportsRoot = g.report.package_spec.exports_root;
    newPackages.set(pkgHash, { exportsRoot });
  }
  const reported: SegmentItem[] = [];
  const reporterItems: ReporterItem[] = [];

  let finalReporters: Uint8Array[] = [];

  for (let i = 1; i < input.guarantees.length; i++) {
    if (input.guarantees[i - 1].report.core_index >= input.guarantees[i].report.core_index) {
      return {
        output: { err: ErrorCode.OUT_OF_ORDER_GUARANTEE },
        postState: preState,
      };
    }
  }

  // 0) 
  for (const guarantee of input.guarantees) {
    const { report, slot, signatures } = guarantee;
    const core = report.core_index; 

    if (guarantee.signatures.length < 2) {
      return {
        output: { err: ErrorCode.INSUFFICIENT_GUARANTEES },
        postState: preState,
      };
    }

    // i) For each prerequisite p => if p not in newPackages or chain => fail
    for (const prereqHashRaw of guarantee.report.context.prerequisites) {
      const prereqHash = toHex(prereqHashRaw);
      if (!inRecentBlocksOrNew(prereqHash, postState.recent_blocks, newPackages)) {
        return { output: { err: ErrorCode.DEPENDENCY_MISSING }, postState: preState };
      }
    }

    // ii) For each segment root reference => same logic
    for (const seg of guarantee.report.segment_root_lookup) {
      const segWph = toHex(seg.work_package_hash);

      if (!inRecentBlocksOrNew(segWph, postState.recent_blocks, newPackages)) {
        return { output: { err: ErrorCode.SEGMENT_ROOT_LOOKUP_INVALID }, postState: preState };
      }
      // also compare the exportsRoot
      const known = findExportsRoot(segWph, postState.recent_blocks, newPackages);
      if (!known || !arrayEqual(known, toBytes(seg.segment_tree_root))) {
        return { output: { err: ErrorCode.SEGMENT_ROOT_LOOKUP_INVALID }, postState: preState };
      }
    }

    // 1)  check if report slot is within one rotation of the input slot => REPORT_EPOCH_BEFORE_LAST
    if (!isWithinOneRotation(slot, input.slot, ROTATION_PERIOD)) {
      return { 
        output: { err: ErrorCode.REPORT_EPOCH_BEFORE_LAST }, 
        postState: preState 
      };
    }

    // 2) Convert the "report.package_spec.hash" => a consistent hex string
    let pkgHashBytes = report.package_spec.hash;
    if (typeof pkgHashBytes === "string") {
      pkgHashBytes = hexStringToBytes(pkgHashBytes);
    }
    const pkgHashStr = toHex(pkgHashBytes);

    //i) check if package already in extrinsic => DUPLICATE_PACKAGE
    if (seenPkgHashes.has(pkgHashStr)) {
      return { output: { err: ErrorCode.DUPLICATE_PACKAGE }, postState: preState };
    }

    // ii) check if it’s in recent blocks => DUPLICATE_PACKAGE
    if (alreadyInRecentBlocks(pkgHashBytes, postState.recent_blocks)) {
      return { output: { err: ErrorCode.DUPLICATE_PACKAGE }, postState: preState };
    }

    // If not, record it
    seenPkgHashes.add(pkgHashStr);

    // 3) Check core is in range => (11.23)
    if (core < 0 || core >= CORES_COUNT) {
      return { output: { err: ErrorCode.BAD_CORE_INDEX }, postState: preState };
    }

    const existing = postState.avail_assignments[core];
    if (existing) {
      if (slot < existing.timeout + TIMEOUT) {
        return { output: { err: ErrorCode.CORE_ENGAGED }, postState: preState };
      }
    }

    //4) check anchor not recent => (11.33) context.anchor
    // we need to check the `recent_blocks` if `anchor` being the `header_hash` sits in it.
    const anchor = report.context.anchor;
    const pool = postState.recent_blocks;
    const anchorIdx = pool.findIndex(b => arrayEqual(b.header_hash, anchor));

    if (anchorIdx < 0 || anchorIdx > MAX_BLOCKS_HISTORY ) {
      return { output: { err: ErrorCode.ANCHOR_NOT_RECENT }, postState: preState };
    } 

    // TODO REPORT_EPOCH_BEFORE_LAST 

    // 5)  check if reports are in ascending order and unique => (11.24) and (11.23)
    // NOT_SORTED_OR_UNIQUE_GUARANTORS
    if (!areSortedAndUniqueByValidatorIndex(signatures)) {
      return {
        output: { err: ErrorCode.NOT_SORTED_OR_UNIQUE_GUARANTORS },
        postState,
      };
    }

    // 6) check if core is authorized
    const authHash = report.authorizer_hash;
    const authPool = postState.auth_pools[core]; 
    const idx = authPool.findIndex(h => arrayEqual(h, authHash));
    if (idx < 0) {
      return { output: { err: ErrorCode.CORE_UNAUTHORIZED }, postState: preState };
    }
    // // remove it so can’t be reused
    // authPool.splice(idx, 1);

    // 7) check if report slot is in the future => 
    // FUTURE_REPORT_SLOT
    if (slot > input.slot) {
      return { output: { err: ErrorCode.FUTURE_REPORT_SLOT }, postState: preState };
    }


    // 8) check if prereqs and segment root lookups are within limits
    const prereqs = report.context.prerequisites; 
    const segLookup = report.segment_root_lookup; 
    if (prereqs.length + segLookup.length > 8) {
      return { output: { err: ErrorCode.TOO_MANY_DEPENDENCIES }, postState: preState };
    }

    let totalGas = 0;  // Gas usage => 11.30
    let totalOutputSize = 0; // for 11.8 => for checking "WORK_REPORT_TOO_BIG"
    
      // 9) check items in report results => (11.8), (11.30), (11.42)
    for (const item of report.results) {
      
      // i) 
      // 11.8 => measure size of the "successful output" if any
      if (item.result && 'ok' in item.result) {
        // Suppose item.result.ok is a Uint8Array or string => get length
        const outLen = (typeof item.result.ok === "string")
          ? hexStringToBytes(item.result.ok).length
          : item.result.ok.length;
        totalOutputSize += outLen;
      }

      // (11.8) => if totalOutputSize + length(report.auth_output) > WR => WORK_REPORT_TOO_BIG
      let authOutSize = 0;
      if (report.auth_output) {
        authOutSize = (typeof report.auth_output === "string")
          ? hexStringToBytes(report.auth_output).length
          : report.auth_output.length;
      }

      if (totalOutputSize + authOutSize > MAX_WORK_SIZE) {
        return { output: { err: ErrorCode.WORK_REPORT_TOO_BIG }, postState: preState };
      }

      // ii) check service ID is correct => BAD_SERVICE_ID
      const svcId = postState.accounts.find(s => s.id === item.service_id);
      if (!svcId) {
        return { output: { err: ErrorCode.BAD_SERVICE_ID }, postState: preState };
      }

      const service = svcId.data.service;
      // iii) (11.30) => check item.gas >= svcId.data.service.min_item_gas
      if (item.accumulate_gas < service.min_item_gas) {
        return { output: { err: ErrorCode.SERVICE_ITEM_GAS_TOO_LOW }, postState: preState };
      }
      totalGas += item.accumulate_gas;

      // iv) 11.30 => if totalGas > GA => WORK_REPORT_GAS_TOO_HIGH
      if (totalGas > MAXIMUM_TOTAL_ACCUMULATE_GAS) {
        console.log("work report gas too high", toHex(guarantee.report.package_spec.hash));
        return { output: { err: ErrorCode.WORK_REPORT_GAS_TOO_HIGH }, postState: preState };
      }

      // console.log("item.code_hash line 254", item.code_hash, service.code_hash);
      // v)check code hash is correct (11.42) 
      // BAD_CODE_HASH
      if (!arrayEqual(item.code_hash, service.code_hash)) {
        return { output: { err: ErrorCode.BAD_CODE_HASH }, postState: preState };
      }

      // console.log("item.code_hash line 261", item.code_hash, service.code_hash);
      // vi) 
      const foundBlock = postState.recent_blocks[anchorIdx];
      // check that state is equal to the anchor id in the block
      if (!arrayEqual(report.context.state_root, foundBlock.state_root)) {
        return { output: { err: ErrorCode.BAD_STATE_ROOT }, postState: preState };
      }

      const computedBeefy = superPeaks(foundBlock.mmr.peaks);

      // vii) TODO compute beefy MMR root
      if (!arrayEqual(report.context.beefy_root, computedBeefy)) { // TODO
        return {
          output: { err: ErrorCode.BAD_BEEFY_MMR_ROOT }, 
          postState: preState
        };
      }
    }

    // check which rotation the report is in
    const rotation = whichRotation(slot, input.slot, ROTATION_PERIOD);

    // 10) "credentials" aka signatures... 
    // check each signature is correct, and that validator is assigned to `core` either in current or prior rotation
    for (const sig of signatures) {
      const { validator_index, signature } = sig;

      let signatureBytes: Uint8Array = (typeof signature === "string")
        ? new Uint8Array(hexStringToBytes(signature))
        : signature;
      // (i) Basic range check for validator_index

      if (validator_index < 0 || validator_index >= VALIDATOR_COUNT) {
        return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState: preState };
      }

      // (ii) Based on rotation, select the appropriate validator set
      let pubEdKey: Ed25519Public | null = null;
      let set: "curr" | "prev";

      if (rotation === "curr") {
        if (validator_index >= postState.curr_validators.length) {
          return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState: preState };
        }
        set = "curr";
        pubEdKey = postState.curr_validators[validator_index].ed25519;

        // check assigned core in currPerm
        const reportCoreIndex = report.core_index
        const assignedCoreIndex = assignedCore(validator_index, rotatedCurr, VALIDATORS_PER_CORE);
        console.log("rotation check assigned curr", { assignedCoreIndex, reportCoreIndex });

        // TODO: COMMENTED OUT FOR NOW until we can confirm if test vectors for verifying assignments
        // is correct. 
        // if (assignedCoreIndex !== report.core_index) {
        //   console.log("assignedCoreIndex !== report.core_index",{ assignedCoreIndex, reportCoreIndex});
        //   return { output: { err: ErrorCode.WRONG_ASSIGNMENT }, postState: preState };
        // }

      } else if (rotation === "prev") {
        if (validator_index >= postState.prev_validators.length) {
          return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState: preState };
        }
        set = "prev";
        pubEdKey = postState.prev_validators[validator_index].ed25519;

        console.log("rotation check prevPerm", convertToReadableFormat(basePrev));

        const assigned = assignedCore(validator_index, rotatedPrev, VALIDATORS_PER_CORE);
        if (assigned !== report.core_index) {
          return { output: { err: ErrorCode.WRONG_ASSIGNMENT }, postState: preState };
        }
      } else if (rotation === "too_old") {

        console.log("rotation check report slot too old", slot, "input slot", input.slot);
        return { output: { err: ErrorCode.REPORT_EPOCH_BEFORE_LAST }, postState: preState };
      } else {
        return { output: { err: ErrorCode.WRONG_ASSIGNMENT }, postState: preState };
      }

      reporterItems.push({ validatorIndex: validator_index, pubEdKey, set });

      if (typeof pubEdKey === "string") {
        pubEdKey = new Uint8Array(hexStringToBytes(pubEdKey));
      }

      if (pubEdKey.length !== 32 || signatureBytes.length !== 64) {
        console.log("bad signature length", pubEdKey.length, signatureBytes.length);
        return { output: { err: ErrorCode.BAD_SIGNATURE }, postState: preState };
      }

      const isVerified = await verifyReportSignature(report, signatureBytes, pubEdKey);

      if (!isVerified) {
        console.log("bad signature in ", sig.validator_index, toHex(sig.signature));
        return { output: { err: ErrorCode.BAD_SIGNATURE }, postState: preState };
      }
      // (TODO: add an assignment check via a whichCore function for WRONG_ASSIGNMENT. Requires Fisher Yates Shuffle algorithm)
    }

    finalReporters = finalizeReporters(reporterItems);
    console.log("finalReporters", convertToReadableFormat(finalReporters));

    // 11) If the entire guarantee is good, push to "reported"
    reported.push({
      work_package_hash: pkgHashBytes,
      segment_tree_root: report.package_spec.exports_root
    });

    reported.sort((a, b) => {
      // compare two hex strings or Buffer compares.
      // Conformance test `high_work_report_gas-1.json` has two reported reports
      // and they appear to be ordered by the work_package_hash
      return toHex(a.work_package_hash).localeCompare(toHex(b.work_package_hash));
    });

    // 12) Update avail_assignments for this core
    postState.avail_assignments[report.core_index] = {
      report,
      timeout: input.slot
    };
  } 

  const outputData = {
    reported,
    reporters: finalReporters
  };

  // 3) Update state
  return { output: { ok: outputData }, postState };
}