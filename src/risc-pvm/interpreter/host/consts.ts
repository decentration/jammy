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


// Accumulate consts for host calls
export const SVC_ID = 0n // !TODO change when outer invocation is supported (bless and assign)
export const CORES_PER_SERVICE = 8; // !TODO stub for Q (assign handler)
export const CORE_BYTES = 32;          // 32-byte hash each (assign handler)
export const CORES_SIZE = CORE_BYTES * CORES_PER_SERVICE; // 256 bytes for 8 cores (assign handler)
export const MAX_BLESS_SELECTOR_SLOTS = 2**16;;  // NS !TODO what is max? (bless handler)
export const BYTES_PER_BLESS_HASH = 12; // 12 bytes for each bless hash (bless handler)
 
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