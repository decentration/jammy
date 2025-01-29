import { ReportsState, ReportsInput, ReportsOutput } from "./types"; 
import { ErrorCode } from "./types"; 
import { arrayEqual } from "../../utils";
import { verify } from "tweetnacl"
import { CORES_COUNT, MAX_BLOCKS_HISTORY } from "../../consts";

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

/**
 * applyReportsStf 
 * Following the conformance naming convention we call it "reports" 
 * because each "guarantee" carries a new Work Report onto the chain, which eventually leads to availability and accumulation.
 * applyReportsStf implements 11.2 – 11.5, Guaruntees.
 * 11.1 state is avail_assignments
 * 11.2 work report definition 
 * eq.'s (11.3), (11.4) and (11.5) are structural constrains 
 *  - (11.3) Guarantor Assignments ∀w ∈ W ∶ SwlS + S(wx)pS ≤ J, where J = 8
 *  
*/
export function applyReportsStf( preState: ReportsState, input: ReportsInput): 
{ output: ReportsOutput; postState: ReportsState } {

//   // 1) If no guarantees, do no op.
//   if (!input.guarantees || input.guarantees.length === 0) {
//     // no changes to state 
//     return { output: null, postState: preState };
//   }

  // 2) Clone preState
  const postState = structuredClone(preState) as ReportsState;

  // process each guarantee in turn.  return
  for (let i = 0; i < input.guarantees.length; i++) {

   
    const guarantee = input.guarantees[i];
    console.log("processing guarantee", guarantee);
    const { report, slot, signatures } = guarantee;
    const core = report.core_index;  // from the work-report

    // 2a) Check core is in range => (11.23)
    if (core < 0 || core >= CORES_COUNT) {
      return { output: { err: ErrorCode.BAD_CORE_INDEX }, postState: preState };
    }

    // 2b) check anshor not recent => (11.33) context.anchor
    // we need to check the `recent_blocks` if `anchor` being the `header_hash` sits in it.
    const anchor = report.context.anchor;
    const pool = postState.recent_blocks;
    const anchorIdx = pool.findIndex(b => arrayEqual(b.header_hash, anchor));

    console.log("anchorIdx", anchorIdx);
    if (anchorIdx < 0 || anchorIdx > MAX_BLOCKS_HISTORY ) {
        console.log("anchor not recent");
      return { output: { err: ErrorCode.ANCHOR_NOT_RECENT }, postState: preState };
    }

    // // 2c  check if reports are in ascending order and unique => (11.24) and (11.23)
    // // NOT_SORTED_OR_UNIQUE_GUARANTORS
    // if (i > 0 && input.guarantees[i - 1].slot >= slot) {
    //   return { output: { err: ErrorCode.NOT_SORTED_OR_UNIQUE_GUARANTORS }, postState: preState };
    // }

    // // 2d) check if report slot is in the future => 
    // // FUTURE_REPORT_SLOT
    // if (slot > input.slot) {
    //   return { output: { err: ErrorCode.FUTURE_REPORT_SLOT }, postState: preState };
    // }

    // // 2e) "credentials" aka signatures... check each signature is correct, and that validator is assigned to `core` either in current or prior rotation
    // for (const sig of signatures) {
    //   const { validator_index, signature } = sig;

    //   // 2e.1)
    //   // basic checks before verifying signature
    //   // check if in range.  (11.24)
    //   if (validator_index >= postState.curr_validators.length || validator_index < 0) {
    //     return { output: { err: ErrorCode.BAD_VALIDATOR_INDEX }, postState: preState };
    //   }

    //   // 2e.2)
    //   // (11.25) check if the validator is assigned to the core in this block's time slot or in the most recent previous 
    //   // set of assignments. 

    //   //  get the ed25519 key in `curr_validators`
    //   const validatorInfo = postState.curr_validators[validator_index]; 
    //   const edKey = validatorInfo.ed25519;

    //   // get ed25519 key in `prev_validators`
    //   const prevValidatorInfo = postState.prev_validators[validator_index];
    //   const prevEdKey = prevValidatorInfo.ed25519;

    //   // if the edKey or prevEdKey is not equal to the signature, return error
    //     if (!arrayEqual(edKey, signature) && !arrayEqual(prevEdKey, signature)) {
    //         return { output: { err: ErrorCode.BAD_SIGNATURE }, postState: preState };
    //     }

    //   const message = buildGuaranteeMessage(report); // TODO
    //   const isOK = verify(signature, message, validatorInfo.ed25519);
    //   if (!isOK) {
    //     return { output: { err: ErrorCode.BAD_SIGNATURE }, postState: preState };
    //   }
    // }

  } 
    // 3) commit changes
  return { output: null, postState };
}
