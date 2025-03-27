


export type PreimagesOutput = { ok: null } | { err: ErrorCode };

export interface Preimage {
  requester: number;  // 4 bytes
  blob: Uint8Array;   // variable
}

export interface PreimagesMapEntry {
  hash: Uint8Array;  // 32 bytes
  blob: Uint8Array;  // variable
}

export interface LookupMetaMapKey {
  hash: Uint8Array; // 32 bytes
  length: number;   // u32
}

export interface LookupMetaMapEntry {
  key: LookupMetaMapKey;
  value: number[];  // TODO an array of up to 3 timeslots?
}

export interface Account {
  preimages: PreimagesMapEntry[];
  lookup_meta: LookupMetaMapEntry[];
}

export interface AccountsMapEntry {
  id: number;    // 4 bytes
  data: Account; 
}

export interface PreimagesState {
  accounts: AccountsMapEntry[];
}

export interface PreimagesInput {
  preimages: Preimage[];
  slot: number;
}

export interface PreimagesStf {
  input: PreimagesInput;
  pre_state: PreimagesState;
  output: PreimagesOutput;
  post_state: PreimagesState;
}

export enum ErrorCode {
  PREIMAGE_UNNEEDED = "preimage_unneeded",
  PREIMAGES_NOT_SORTED_UNIQUE = "preimages_not_sorted_unique"
}

export const PREIMAGES_ERROR_CODES: ErrorCode[] = [
  ErrorCode.PREIMAGE_UNNEEDED,
  ErrorCode.PREIMAGES_NOT_SORTED_UNIQUE
];

