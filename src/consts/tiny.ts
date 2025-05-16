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
export const TOTAL_ACCUMULATE_GAS = 10000000;  // GA: 11.30 => maximum total accumulate_gas => The gas allocated to invoke a work-report’s Accumulation logic.
export const MAX_WORK_SIZE = 48*1024; // 11.8 => 48 KiB of output data
export const TIMEOUT = 10;            // 11.31 => 10 slots
export const ROTATION_PERIOD = 4 // 
export const MAX_AGE_IN_TIMESLOTS = 60 // Production: L = 14, 400: The maximum age in timeslots of the lookup anchor.
export const PEAK_PREFIX = "peak"; 
export const VALIDATORS_PER_CORE = VALIDATOR_COUNT / CORES_COUNT; // 1023 / 341 or 6 / 2 = 3  
export const VOTE_COUNT = (2/3 * VALIDATOR_COUNT) + 1; 
export const CONTEST_DURATION = 10; // Y
export const VALIDATOR_SUPERMAJORITY = 5; // ceiling(2/3 * 6) + 1
export const TOTAL_GAS_FOR_ALL_ACCUMULATION = 3500000000; //GT = 3, 500, 000, 000: The total gas allocated across for all Accumulation. Should be no smaller than GA ⋅ C + ∑g∈V(χg )(g).
export const TOTAL_GAS_FOR_WORK_PACKAGE_REFINE_LOGIC = 5000000000 // GR = 5, 000, 000, 000: The gas allocated to invoke a work-package’s Refine logic.
export const TOTAL_GAS_FOR_WORK_PACKAGE_IS_AUTHORIZED_LOGIC = 50000000  // GI = 50, 000, 000: The gas allocated to invoke a work-package’s Is-Authorized logic. 
export const MAX_EXTRINSICS_IN_WORK_PACKAGE = 128 // T = 128: The maximum number of extrinsics in a work-package.
export const MAX_IMPORTS_EXPORTS_IN_WORK_PACKAGE = 3072 // WM = 3, 072: The maximum number of imports and exports in a work-package.
export const PERIOD_FOR_EXPUNGING_PREIMAGES = 19200 // D = 19, 200: The period in timeslots after which an unreferenced preimage may be expunged.
