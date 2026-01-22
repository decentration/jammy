export const VALIDATOR_COUNT = 6; // 1023 in production
export const CORES_COUNT = 2; // 341 in production
export const BITFIELD_LENGTH = 1;
export const EPOCH_LENGTH = 12; // 600 in production
export const MAX_TICKET_PER_BLOCK = 3; // 16 in production 
export const TICKETS_PER_VALIDATOR = 3; // 2 in production
export const MAX_BLOCKS_HISTORY = 8; // 8 in production? TODO: check
export const TIMESLOT_DELAY_PERIOD = 5 // In GP its value  "U". The period in timeslots after which reported but unavailable work may be replaced.
export const AUTH_QUEUE_SIZE = 80;
export const AUTH_POOL_MAX_SIZE = 8
export const TOTAL_ACCUMULATE_GAS = 10000000n;  // GA: 11.30 => maximum total accumulate_gas => The gas allocated to invoke a work-report’s Accumulation logic.
export const MAX_WORK_SIZE = 48 * 1024; // 11.8 => 48 KiB of output data
export const TIMEOUT = 10;            // 11.31 => 10 slots
export const ROTATION_PERIOD = 4 // 
export const LOOKUP_ANCHOR_MAX_AGE = 24 // Tiny chainspec: 24 (confirmed from PVM debugger)
export const PEAK_PREFIX = "peak";
export const VALIDATORS_PER_CORE = VALIDATOR_COUNT / CORES_COUNT; // 1023 / 341 or 6 / 2 = 3  
export const VOTE_COUNT = (2 / 3 * VALIDATOR_COUNT) + 1;
export const CONTEST_DURATION = 10; // Y
export const VALIDATOR_SUPERMAJORITY = 5; // ceiling(2/3 * 6) + 1
export const TOTAL_GAS_FOR_ALL_ACCUMULATION = 20000000n;
export const TOTAL_GAS_FOR_WORK_PACKAGE_REFINE_LOGIC = 1000000000n
export const TOTAL_GAS_FOR_WORK_PACKAGE_IS_AUTHORIZED_LOGIC = 50000000n  // GI = 50, 000, 000: The gas allocated to invoke a work-package’s Is-Authorized logic. 
export const MAX_EXTRINSICS_IN_WORK_PACKAGE = 128 // T = 128: Tiny chainspec (confirmed from PVM debugger)
export const MAX_IMPORTS_EXPORTS_IN_WORK_PACKAGE = 3072 // WM = 3, 072: The maximum number of imports and exports in a work-package.
// Tiny chainspec: preimage_expunge_period = 32
export const PERIOD_FOR_EXPUNGING_PREIMAGES = 32
export const EC_PIECES_PER_SEGMENT = 1026;

// Tiny erasure-coding overrides (conformance test configuration)
// These DIFFER from GP I.4 canonical values (WE=684, WP=6)
export const WE_OVERRIDE = 4;  // GP I.4: WE = 684
export const WP_OVERRIDE = EC_PIECES_PER_SEGMENT;  // GP I.4: WP = 6

