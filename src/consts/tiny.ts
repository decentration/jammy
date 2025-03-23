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
export const MAXIMUM_TOTAL_ACCUMULATE_GAS = 10000000;              // 11.30 => maximum total accumulate_gas
export const MAX_WORK_SIZE = 48*1024; // 11.8 => 48 KiB of output data
export const TIMEOUT = 10;            // 11.31 => 10 slots
export const ROTATION_PERIOD = 4 // 
export const MAX_AGE_IN_TIMESLOTS = 60 // Production: L = 14, 400: The maximum age in timeslots of the lookup anchor.
export const PEAK_PREFIX = "peak"; 
export const VALIDATORS_PER_CORE = VALIDATOR_COUNT / CORES_COUNT; // 1023 / 341 or 6 / 2 = 3  
export const VOTE_COUNT = (2/3 * VALIDATOR_COUNT) + 1; 
export const CONTEST_DURATION = 10; // Y
 export const VALIDATOR_SUPERMAJORITY = 5; // ceiling(2/3 * 6) + 1

