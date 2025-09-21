export const OK    = 0n;
export const NONE  = (1n << 64n) - 1n; // 18446744073709551615n
export const WHAT  = (1n << 64n) - 2n; // 18446744073709551614n
export const OOB   = (1n << 64n) - 3n; // 18446744073709551613n
export const WHO   = (1n << 64n) - 4n; // 18446744073709551612n
export const FULL  = (1n << 64n) - 5n; // 18446744073709551611n
export const CORE  = (1n << 64n) - 6n; // 18446744073709551610n
export const CASH  = (1n << 64n) - 7n; // 18446744073709551609n
export const LOW   = (1n << 64n) - 8n; // 18446744073709551608n
export const HUH   = (1n << 64n) - 9n; // 18446744073709551607n


// Inner PVM fault codes
export const HALT = 0n // : The invocation completed and halted normally.
export const PANIC = 1n //: The invocation completed with a panic.
export const FAULT = 2n //: The invocation completed with a page fault.
export const HOST = 3n  //: The invocation completed with a host-call fault.
export const OOG = 4n // The invocation completed by running out of gas.


// info handler:
export const INFO_BYTES = 32 + 16 + 8 + 8 + 8 + 4 + 4;

//designate hander:
export const V_SLOTS        = 8;   // NV !TODO (correct?)
export const BYTES_PER_SLOT = 336; // 336-byte records
export const PAYLOAD_BYTES  = V_SLOTS * BYTES_PER_SLOT;

// NEW HANDLER:
export const ACTIVATION_FEE = 10n;             // !TODO - stub - at  – activation-fee
export const HASH_BYTES     = 32;             // each code-hash is 32 B
export const MAX_LABEL      = 0xffff_ffffn;   // 2^32 -1 , label domain N2^32

export const WILDCARD = (1n << 64n) - 1n;


export const BI = 10
export const BL = 1
export const BS = 100
export const C = 341
export const D = 19_200
export const E = 600
export const F = 2 //The audit bias factor, the expected number of additional validators who will audit a work-report in the following tranche for each no-show in the previous.
export const GA = 10_000_000 // The gas allocated to invoke a work-report’s Accumulation logic.
export const GI = 50_000_000 // The gas allocated to invoke a work-package’s Is-Authorized logic.
export const GR = 5_000_000_000 // The gas allocated to invoke a work-package’s Refine logic.
export const GT = 3_500_000_000 // The total gas allocated across for all Accumulation. Should be no smaller than GA ⋅ C + ∑g∈V(χg )(g).

export const H = 8 //The size of recent history, in blocks.
export const I = 16 // The maximum amount of work items in a package.
export const J = 8 // The maximum sum of dependency items in a work-report.
export const K = 16 // The maximum number of tickets which may be submitted in a single extrinsic.
export const L = 14_400 // The maximum age in timeslots of the lookup anchor.
export const N = 2 // The number of ticket entries per validator.
export const O = 8 // The maximum number of items in the authorizations pool.
export const P = 6 // The slot period, in seconds.
export const Q = 80 // The number of items in the authorizations queue.
export const R = 10 // The rotation period of validator-core assignments, in timeslots.
export const S = 1024 // The maximum number of entries in the accumulation queue.
export const T = 128 // The maximum number of extrinsics in a work-package.
export const U = 5 // The period in timeslots after which reported but unavailable work may be replaced.
export const V = 1023 // The total number of validators.

export const WA = 64_000 // The maximum size of is-authorized code in octets.
export const WB = 12 * 2 ** 20 // The maximum size of an encoded work-package together with its extrinsic data and import implications, in octets.
export const WC = 4_000_000 // The maximum size of service code in octets.
export const WE = 684 // The basic size of erasure-coded pieces in octets. See equation H.6.
export const WP = 6 // The number of erasure-coded pieces in a segment.
export const WG = WP * WE // = 4104 The size of a segment in octets.
export const WM = 3_072 // The maximum number of imports in a work-package.
export const WR = 48 * 2 ** 10 // The maximum total size of all unbounded blobs in a work-report, in octets.
export const WT = 128 // The size of a transfer memo in octets.
export const WX = 3_072 // The maximum number of exports in a work-package.
export const Y = 500 // The number of slots into an epoch at which ticket-submission ends.
export const ZA = 2 // The pvm dynamic address alignment factor. See equation A.18.
export const ZI = 1 << 24 // The standard pvm program initialization input data size. See equation A.7.
export const ZP = 1 << 12 // The pvm memory page size. See equation 4.24.
export const ZZ = 1 << 16 // The standard pvm program initialization zone size. See section A.7.

// Accumulate consts for host calls
export const SVC_ID = 0n // !TODO change when outer invocation is supported (bless and assign)
export const CORE_BYTES = 32;          // 32-byte hash each (assign handler)
export const CORES_SIZE = CORE_BYTES * Q; // 2560 bytes for 80 cores (assign handler)
export const MAX_BLESS_SELECTOR_SLOTS = 2**16;;  // NS !TODO what is max? (bless handler)
export const BYTES_PER_BLESS_HASH = 12; // 12 bytes for each bless hash (bless handler)
 

// -- Inner Memory Paging
export const PAGE_SIZE = 1 << 12;       // 4096 bytes
export const MIN_PAGE  = 16;            // p >= 16
export const MAX_PAGES = 1 << 20;       // 2^32 / 2^12 = 1,048,576


// -- New Handler for check allocation ring
export const RING_START = 1n << 8n;
export const STEP  = 1n << 9n;
export const RING_SPAN = (1n << 32n) - STEP;