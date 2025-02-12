import { AvailAssignment, Ed25519Public, Guarantee, SegmentItem } from "../../types/types";
import { ValidatorInfo } from "../types";
import { BlockItem } from "../types";

export interface ReportsInput { 
    guarantees: Guarantee[], 
    slot: number 
}


export type ReportsOutput = 
{ err: ErrorCode } | { ok: OkData } | null;

export interface ReportsState { 
    avail_assignments: (AvailAssignment | null)[],
    curr_validators:ValidatorInfo[],
    prev_validators: ValidatorInfo[],
    entropy: Uint8Array[],
    offenders: Uint8Array[],
    recent_blocks: BlockItem[],
    auth_pools: Uint8Array[][],
    accounts: ServiceItem[]
}

export interface OkData {
    reported: SegmentItem[],
    reporters: Ed25519Public[]
}

// Output type which is either Err or Ok
export type Output = { err: ErrorCode } | { ok: OkData } | null; 

export enum ErrorCode {
    BAD_CORE_INDEX = "bad_core_index",
    FUTURE_REPORT_SLOT = "future_report_slot",
    REPORT_EPOCH_BEFORE_LAST = "report_epoch_before_last",
    INSUFFICIENT_GUARANTEES = "insufficient_guarantees",
    OUT_OF_ORDER_GUARANTEE = "out_of_order_guarantee",
    NOT_SORTED_OR_UNIQUE_GUARANTORS = "not_sorted_or_unique_guarantors",
    WRONG_ASSIGNMENT = "wrong_assignment",
    CORE_ENGAGED = "core_engaged",
    ANCHOR_NOT_RECENT = "anchor_not_recent",
    BAD_SERVICE_ID = "bad_service_id",
    BAD_CODE_HASH = "bad_code_hash",
    DEPENDENCY_MISSING = "dependency_missing",
    DUPLICATE_PACKAGE = "duplicate_package",
    BAD_STATE_ROOT = "bad_state_root",
    BAD_BEEFY_MMR_ROOT = "bad_beefy_mmr_root",
    CORE_UNAUTHORIZED = "core_unauthorized",
    BAD_VALIDATOR_INDEX = "bad_validator_index",
    WORK_REPORT_GAS_TOO_HIGH = "work_report_gas_too_high",
    SERVICE_ITEM_GAS_TOO_LOW = "service_item_gas_too_low",
    TOO_MANY_DEPENDENCIES = "too_many_dependencies",
    SEGMENT_ROOT_LOOKUP_INVALID = "segment_root_lookup_invalid",
    BAD_SIGNATURE = "bad_signature",
    WORK_REPORT_TOO_BIG = "work_report_too_big"
  }

  export const REPORTS_ERROR_CODES: ErrorCode[] = [
    ErrorCode.BAD_CORE_INDEX,
    ErrorCode.FUTURE_REPORT_SLOT,
    ErrorCode.REPORT_EPOCH_BEFORE_LAST,
    ErrorCode.INSUFFICIENT_GUARANTEES,
    ErrorCode.OUT_OF_ORDER_GUARANTEE,
    ErrorCode.NOT_SORTED_OR_UNIQUE_GUARANTORS,
    ErrorCode.WRONG_ASSIGNMENT,
    ErrorCode.CORE_ENGAGED,
    ErrorCode.ANCHOR_NOT_RECENT,
    ErrorCode.BAD_SERVICE_ID,
    ErrorCode.BAD_CODE_HASH,
    ErrorCode.DEPENDENCY_MISSING,
    ErrorCode.DUPLICATE_PACKAGE,
    ErrorCode.BAD_STATE_ROOT,
    ErrorCode.BAD_BEEFY_MMR_ROOT,
    ErrorCode.CORE_UNAUTHORIZED,
    ErrorCode.BAD_VALIDATOR_INDEX,
    ErrorCode.WORK_REPORT_GAS_TOO_HIGH,
    ErrorCode.SERVICE_ITEM_GAS_TOO_LOW,
    ErrorCode.TOO_MANY_DEPENDENCIES,
    ErrorCode.SEGMENT_ROOT_LOOKUP_INVALID,
    ErrorCode.BAD_SIGNATURE,
    ErrorCode.WORK_REPORT_TOO_BIG
  ];


  export interface ServiceInfo {
    service: {
    code_hash: Uint8Array; // 32 bytes
    balance: number;       // u64
    min_item_gas: number;   // u32
    min_memo_gas: number;   // u32
    bytes: number;         // u64
    items: number; 
    }        // u32
  }

  export interface ServiceItem {
    id: number;  // u32
    data: ServiceInfo;
  }

  export interface Reports {
    input: ReportsInput;
    pre_state: ReportsState;
    output: ReportsOutput;
    post_state: ReportsState;
  }
  
  export interface ReporterItem {
    validatorIndex: number;
    pubEdKey: Uint8Array;
    set: "curr" | "prev";
  }