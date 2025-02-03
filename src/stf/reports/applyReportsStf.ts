import { ReportsState, ReportsInput, ReportsOutput } from "./types"; 
import { ErrorCode } from "./types"; 
import { arrayEqual, toHex } from "../../utils";
import { CORES_COUNT, MAX_BLOCKS_HISTORY, VALIDATOR_COUNT } from "../../consts";
import { alreadyInRecentBlocks, areSortedAndUniqueByValidatorIndex, findExportedPackage, isKnownPackage } from "./helpers";
import { Ed25519Public } from "../../types/types";
import { verifyReportSignature } from "./verifyReportSignature";
import { hexStringToBytes } from "../../codecs";

// for reference:
// export enum ErrorCode {
//     BAD_CORE_INDEX = "bad_core_index",
//     FUTURE_REPORT_SLOT = "future_report_slot",
//     REPORT_EPOCH_BEFORE_LAST = "report_epoch_before_last",
//     INSUFFICIENT_GUARANTEES = "insufficient_guarantees",
//     OUT_OF_ORDER_GUARANTEE = "out_of_order_guarantee",
//     NOT_SORTED_OR_UNIQUE_GUARANTORS = "not_sorted_or_unique_guarantors",
//     WRONG_ASSIGNMENT = "wrong_assignment",
//     CORE_ENGAGED = "core_engaged",
//     ANCHOR_NOT_RECENT = "anchor_not_recent",
//     BAD_SERVICE_ID = "bad_service_id",
//     BAD_CODE_HASH = "bad_code_hash",
//     DEPENDENCY_MISSING = "dependency_missing",
//     DUPLICATE_PACKAGE = "duplicate_package",
//     BAD_STATE_ROOT = "bad_state_root",
//     BAD_BEEFY_MMR_ROOT = "bad_beefy_mmr_root",
//     CORE_UNAUTHORIZED = "core_unauthorized",
//     BAD_VALIDATOR_INDEX = "bad_validator_index",
//     WORK_REPORT_GAS_TOO_HIGH = "work_report_gas_too_high",
//     SERVICE_ITEM_GAS_TOO_LOW = "service_item_gas_too_low",
//     TOO_MANY_DEPENDENCIES = "too_many_dependencies",
//     SEGMENT_ROOT_LOOKUP_INVALID = "segment_root_lookup_invalid",
//     BAD_SIGNATURE = "bad_signature",
//     WORK_REPORT_TOO_BIG = "work_report_too_big"
//   }


const GA = 50000;              // 11.30 => maximum total accumulate_gas
const MAX_WORK_SIZE = 48*1024; // 11.8 => 48 KiB of output data


/**
 * applyReportsStf 
 * Following the conformance naming convention we call it "reports" 
 * because each "guarantee" carries a new Work Report onto the chain, which eventually leads to availability and accumulation.
 * applyReportsStf implements 11.2 – 11.5, Guaruntees.
 * 11.1 state is avail_assignments
 * 11.2 work report definition 
 * eq.'s (11.3), (11.4) and (11.5) are structural constrains 
 *  - (11.3) Guarantor Assignments ∀w ∈ W ∶ SwlS + S(wx)pS ≤ J, where J = 8
 *  -  TODO improve description 
*/
export async function applyReportsStf( preState: ReportsState, input: ReportsInput): 
Promise<{ output: ReportsOutput; postState: ReportsState; }> {

  if (!input.guarantees || input.guarantees.length === 0) {
    // no changes to state 
    return { output: null, postState: preState };
  }

  // 1) Clone preState
  const postState = structuredClone(preState) as ReportsState;
  const seenPkgHashes = new Set<string>();

  for (let i = 0; i < input.guarantees.length; i++) {

    const guarantee = input.guarantees[i];
    console.log("processing guarantee", guarantee);
    const { report, slot, signatures } = guarantee;
    const core = report.core_index; 

    // 2a) Convert the "report.package_spec.hash" => a consistent hex string
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

    //4) check anshor not recent => (11.33) context.anchor
    // we need to check the `recent_blocks` if `anchor` being the `header_hash` sits in it.
    const anchor = report.context.anchor;
    const pool = postState.recent_blocks;
    const anchorIdx = pool.findIndex(b => arrayEqual(b.header_hash, anchor));

    if (anchorIdx < 0 || anchorIdx > MAX_BLOCKS_HISTORY ) {
      return { output: { err: ErrorCode.ANCHOR_NOT_RECENT }, postState: preState };
    } 


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
    // remove it so can’t be reused
    authPool.splice(idx, 1);

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
        console.log("item.result.ok", item.result.ok);
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
      console.log("authOutSize + totalOutputSize", authOutSize, totalOutputSize);
      if (totalOutputSize + authOutSize > MAX_WORK_SIZE) {
        console.log("work report too big");
        return { output: { err: ErrorCode.WORK_REPORT_TOO_BIG }, postState: preState };
      }


      // ii) check service ID is correct
      // BAD_SERVICE_ID
      const svcId = postState.services.find(s => s.id === item.service_id);
      if (!svcId) {
        return { output: { err: ErrorCode.BAD_SERVICE_ID }, postState: preState };
      }


      // iii) 
      // (11.30) => check item.gas >= svcId.info.min_item_gas
      if (item.accumulate_gas < svcId.info.min_item_gas) {
        return { output: { err: ErrorCode.SERVICE_ITEM_GAS_TOO_LOW }, postState: preState };
      }
      totalGas += item.accumulate_gas;



      // iv)) check code hash is correct (11.42)
      // BAD_CODE_HASH
      if (!arrayEqual(item.code_hash, svcId.info.code_hash)) {
        return { output: { err: ErrorCode.BAD_CODE_HASH }, postState: preState };
      }


      // v) 11.30 => if totalGas > GA => WORK_REPORT_GAS_TOO_HIGH
      if (totalGas > GA) {
        return { output: { err: ErrorCode.WORK_REPORT_GAS_TOO_HIGH }, postState: preState };
      }

      // vi) 
      const foundBlock = postState.recent_blocks[anchorIdx];
      // check that state is equal to the anchor id in the block
      if (!arrayEqual(report.context.state_root, foundBlock.state_root)) {
        return { output: { err: ErrorCode.BAD_STATE_ROOT }, postState: preState };
      }

      // vii) TODO compute beefy MMR root
      // if (!arrayEqual(report.context.beefy_root, computedBeefy)) { // TODO
      //   return {
      //     output: { err: ErrorCode.BAD_BEEFY_MMR_ROOT }, 
      //     postState: preState
      //   };
      // }


      const segLookups = report.segment_root_lookup || [];

      // vii) For each segment root reference => check and veify existence and correctness
      for (const segItem of segLookups) {
        let rootBytes: Uint8Array;
        if (typeof segItem.segment_tree_root === "string") {
          rootBytes = hexStringToBytes(segItem.segment_tree_root);
        } else {
          rootBytes = segItem.segment_tree_root;
        }

        if (rootBytes.length !== 32) {
          return {
            output: { err: ErrorCode.SEGMENT_ROOT_LOOKUP_INVALID },
            postState: preState
          };
        }
        
        let wphBytes: Uint8Array;
        if (typeof segItem.work_package_hash === "string") {
          wphBytes = hexStringToBytes(segItem.work_package_hash);
        } else {
          wphBytes = segItem.work_package_hash;
        }

        // viii) get the exported package and check if it's known
        const found = findExportedPackage(postState.recent_blocks, wphBytes);
        if (!found) {
          // The older package wasn't found => dependency missing
          return {
            output: { err: ErrorCode.SEGMENT_ROOT_LOOKUP_INVALID },
            postState: preState
          };
        }
      
        // ix) Compare the found `exports_root` with the `segment_tree_root` 
        if (!arrayEqual(rootBytes, found.exports_root)) {
          return {
            output: { err: ErrorCode.SEGMENT_ROOT_LOOKUP_INVALID },
            postState: preState
          };
        }
      }

      // x) For each prerequisite p => check if known
      for (const p of prereqs) {
        
        const pBytes = (typeof p === "string") ? hexStringToBytes(p) : p;
        if (!isKnownPackage(pBytes, postState.recent_blocks, seenPkgHashes)) {
          console.log("dependency missing 2");
          return {
            output: { err: ErrorCode.DEPENDENCY_MISSING },
            postState: preState
          };
        }
      }
    }

   
    // 10) "credentials" aka signatures... 
    // check each signature is correct, and that validator is assigned to `core` either in current or prior rotation
    for (const sig of signatures) {
      const { validator_index, signature } = sig;

      let signatureBytes: Uint8Array;
      if (typeof signature === "string") {
        signatureBytes = new Uint8Array(hexStringToBytes(signature));
      } else {
        signatureBytes = signature;
      }
      
      // i)
      // basic checks before verifying signature
      // check if in range.  (11.24)
      if (validator_index >= VALIDATOR_COUNT || validator_index < 0) {
        console.log("bad validator index");
        return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState: preState };
      }

      // ii) check if the validator is in the current or previous validators
      // (11.25) check if the validator is assigned to the core in this block's time slot or in the most recent previous 
      // set of assignments. 
      let pubEdKey: Ed25519Public | null = null

      if (validator_index < postState.curr_validators.length) {
        pubEdKey = postState.curr_validators[validator_index].ed25519;
        console.log("pubEdKey", pubEdKey);
      } else if (validator_index < postState.prev_validators.length) {
        pubEdKey = postState.prev_validators[validator_index].ed25519;
        console.log("pubEdKey", pubEdKey);
      } else {
        return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState: preState };
      }

      if (typeof pubEdKey === "string") {
        pubEdKey = new Uint8Array(hexStringToBytes(pubEdKey));
        console.log("converted pubEdKey", pubEdKey.length);
      } 

      let isValidSignature = false;

      // iii) check signature is valid
      if (pubEdKey) {
        // basic validation checks
        if (pubEdKey.length !== 32 || signatureBytes.length !== 64) {
          console.log("bad signature length", pubEdKey.length, signatureBytes.length );
          return { output: { err: ErrorCode.BAD_SIGNATURE }, postState: preState };
        }

        // check if the signature is valid
        const isVerified = await verifyReportSignature(report, signatureBytes, pubEdKey);
        if (isVerified) {
          isValidSignature = true;
          console.log("signature is valid");
        } 
        if (!isValidSignature) {
          isValidSignature = false;
          return { output: { err: ErrorCode.BAD_SIGNATURE }, postState: preState };
        }
      }

      //... whichCore WRONG_ASSIGNMENT... TODO
      // // ii) Check assignment => (11.26)
      // const coreNow = whichCore(validator_index, postState.curr_validators, input.slot);
      // const corePrev = whichCore(validator_index, postState.prev_validators, input.slot);
      // if (core !== coreNow && core !== corePrev) {
      //   return { output: { err: ErrorCode.WRONG_ASSIGNMENT }, postState: preState };
      // }        
    }


    // 3) Update state
    //... WIP TODO

  } 
  return { output: null, postState };
}


