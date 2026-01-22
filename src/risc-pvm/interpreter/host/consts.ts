export const OK = 0n;
export const NONE = (1n << 64n) - 1n; // 18446744073709551615n
export const WHAT = (1n << 64n) - 2n; // 18446744073709551614n
export const OOB = (1n << 64n) - 3n; // 18446744073709551613n
export const WHO = (1n << 64n) - 4n; // 18446744073709551612n
export const FULL = (1n << 64n) - 5n; // 18446744073709551611n
export const CORE = (1n << 64n) - 6n; // 18446744073709551610n
export const CASH = (1n << 64n) - 7n; // 18446744073709551609n
export const LOW = (1n << 64n) - 8n; // 18446744073709551608n
export const HUH = (1n << 64n) - 9n; // 18446744073709551607n


// Inner PVM fault codes
export const HALT = 0n // : The invocation completed and halted normally.
export const PANIC = 1n //: The invocation completed with a panic.
export const FAULT = 2n //: The invocation completed with a page fault.
export const HOST = 3n  //: The invocation completed with a host-call fault.
export const OOG = 4n // The invocation completed by running out of gas.


// info handler:
export const INFO_BYTES = 32 + 16 + 8 + 8 + 8 + 4 + 4;

//designate hander:
export const V_SLOTS = 8;   // NV !TODO (correct?)
export const BYTES_PER_SLOT = 336; // 336-byte records
export const PAYLOAD_BYTES = V_SLOTS * BYTES_PER_SLOT;

// NEW HANDLER:
export const ACTIVATION_FEE = 10n;             // !TODO - stub - at  – activation-fee
export const HASH_BYTES = 32;             // each code-hash is 32 B
export const MAX_LABEL = 0xffff_ffffn;   // 2^32 -1 , label domain N2^32

export const WILDCARD = (1n << 64n) - 1n;


// Protocol parameters for ΩY Config fetch.
// These must match the active `CHAIN_TYPE` (tiny/full) because the service PVM validates them.
import {
  AUTH_POOL_MAX_SIZE,
  AUTH_QUEUE_SIZE,
  CORES_COUNT,
  CONTEST_DURATION,
  EPOCH_LENGTH,
  LOOKUP_ANCHOR_MAX_AGE,
  MAX_BLOCKS_HISTORY,
  MAX_EXTRINSICS_IN_WORK_PACKAGE,
  MAX_IMPORTS_EXPORTS_IN_WORK_PACKAGE,
  MAX_TICKET_PER_BLOCK,
  MAX_WORK_SIZE,
  PERIOD_FOR_EXPUNGING_PREIMAGES,
  ROTATION_PERIOD,
  TIMESLOT_DELAY_PERIOD,
  TICKETS_PER_VALIDATOR,
  TOTAL_ACCUMULATE_GAS,
  TOTAL_GAS_FOR_ALL_ACCUMULATION,
  TOTAL_GAS_FOR_WORK_PACKAGE_IS_AUTHORIZED_LOGIC,
  TOTAL_GAS_FOR_WORK_PACKAGE_REFINE_LOGIC,
  VALIDATOR_COUNT,
  EC_PIECES_PER_SEGMENT,
  WE_OVERRIDE,
  WP_OVERRIDE
} from "../../../consts";

export const BI = 10;
export const BL = 1;
export const BS = 100;
export const C = CORES_COUNT;
export const D = PERIOD_FOR_EXPUNGING_PREIMAGES;
export const E = EPOCH_LENGTH;
export const F = 2; // audit bias factor (not currently chain-configured)
export const GA = TOTAL_ACCUMULATE_GAS;
export const GI = TOTAL_GAS_FOR_WORK_PACKAGE_IS_AUTHORIZED_LOGIC;
export const GR = TOTAL_GAS_FOR_WORK_PACKAGE_REFINE_LOGIC;
export const GT = TOTAL_GAS_FOR_ALL_ACCUMULATION;

export const H = MAX_BLOCKS_HISTORY; // recent history size, blocks
export const I = 16 // The maximum amount of work items in a package.
export const J = 8 // The maximum sum of dependency items in a work-report.
export const K = MAX_TICKET_PER_BLOCK; // max tickets per extrinsic
export const L = LOOKUP_ANCHOR_MAX_AGE; // lookup anchor max age (timeslots)
export const N = TICKETS_PER_VALIDATOR; // tickets per validator
export const O = AUTH_POOL_MAX_SIZE; // auth pool max size
export const P = 6 // The slot period, in seconds.
export const Q = AUTH_QUEUE_SIZE; // auth queue size
export const R = ROTATION_PERIOD; // validator-core assignment rotation period (timeslots)
export const S = 1024 // The maximum number of entries in the accumulation queue.
export const T = MAX_EXTRINSICS_IN_WORK_PACKAGE; // max extrinsics per work-package
export const U = TIMESLOT_DELAY_PERIOD; // unavailable replacement period (timeslots)
export const V = VALIDATOR_COUNT; // validator count

export const WA = 64_000 // The maximum size of is-authorized code in octets.
// WB moved below dependencies
export const WC = 4_000_000 // The maximum size of service code in octets.

// Graypaper I.4 Canonical Erasure-Coding Values (v0.7.2) - for reference
export const WE_GRAYPAPER = 684;  // The basic size of erasure-coded pieces in octets. (H.4)
export const WP_GRAYPAPER = 6;    // The number of erasure-coded pieces in a segment.
export const WG_GRAYPAPER = WP_GRAYPAPER * WE_GRAYPAPER; // = 4104 segment size

// Active erasure-coding values (sourced from chainspec - may differ from Graypaper for conformance testing)
export const WE = WE_OVERRIDE;  // Graypaper: 684, Tiny: 4
export const WP = WP_OVERRIDE;  // Graypaper: 6, Tiny: 1026
export const WG = WP * WE // The size of a segment in octets.
export const WM = MAX_IMPORTS_EXPORTS_IN_WORK_PACKAGE // max imports
export const WR = MAX_WORK_SIZE // max work-report output size (octets)
export const WT = 128 // The size of a transfer memo in octets.
export const WX = MAX_IMPORTS_EXPORTS_IN_WORK_PACKAGE // max exports
export const WB = 13791360
export const Y = CONTEST_DURATION // (tiny config uses this as Y)
export const ZA = 2 // The pvm dynamic address alignment factor. See equation A.18.
export const ZI = 1 << 24 // The standard pvm program initialization input data size. See equation A.7.
export const ZP = 1 << 12 // The pvm memory page size. See equation 4.24.
export const ZZ = 1 << 16 // The standard pvm program initialization zone size. See section A.7.


const U32 = 0x1_0000_0000;                // 2^32
// A.43: r0 = 2^32 - 2^16 = 0xFFFF0000 (stack top)
// A.43: r1 = 2^32 - 2ZZ - ZI = 0xFEFE0000 (args base)  
// A.43: r7 = 2^32 - ZZ - ZI = 0xFEFF0000 (args end)
export const STACK_TOP = (U32 - (1 << 16)) >>> 0;       // 0xFFFF0000 (r0)
export const ARGS_BASE = (U32 - 2 * ZZ - ZI) >>> 0;     // 0xFEFE0000 (r1) 
export const ARGS_END = (U32 - ZZ - ZI) >>> 0;         // 0xFEFF0000 (r7)
export const STACK_START = ARGS_END;                    // Stack: 0xFEFF0000 - 0xFFFF0000
export const STACK_SIZE = STACK_TOP - STACK_START;      // Should be 0x10000 = 65536

export const isInArgsBand = (addr: number, len = 1) =>
  addr >= ARGS_BASE && (addr + len) <= ARGS_END;

export const isInStackBand = (addr: number, len = 1) =>
  addr >= STACK_START && (addr + len) <= STACK_TOP;


// Accumulate consts for host calls
export const SVC_ID = 0n // !TODO change when outer invocation is supported (bless and assign)
export const CORE_BYTES = 32;          // 32-byte hash each (assign handler)
export const CORES_SIZE = CORE_BYTES * Q; // 2560 bytes for 80 cores (assign handler)
export const MAX_BLESS_SELECTOR_SLOTS = 2 ** 16;;  // NS !TODO what is max? (bless handler)
export const BYTES_PER_BLESS_HASH = 12; // 12 bytes for each bless hash (bless handler)


// -- Inner Memory Paging
export const PAGE_SIZE = 1 << 12;       // 4096 bytes
export const MIN_PAGE = 16;            // p >= 16
export const MAX_PAGES = 1 << 20;       // 2^32 / 2^12 = 1,048,576


// -- New Handler for check allocation ring
export const RING_START = 1n << 8n;
export const STEP = 1n << 9n;
export const RING_SPAN = (1n << 32n) - STEP;


// ---
export const STORAGE_ENTRY_OVERHEAD = 34; // Per-entry overhead in storage footprint calculation. Each storage entry includes: 32-byte key hash + 2 bytes for length encoding

