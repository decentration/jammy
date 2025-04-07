import { Bytes, Codec, u32 } from "scale-ts";
import { OpaqueHash, Report } from "../../types";
import { Entropy } from "../reports/types";

export type ServiceId = number; // u32
export type Gas = number; // u64    
export type AccountId = number; // u32
export type WorkPackageHash = OpaqueHash;

export const AccountIdCodec = u32;
export const WorkPackageHashCodec = Bytes(32);

export type Reports = Report[]; 

export interface AccumulateInput { 
    slot: number,
    reports: Reports, 
}

export type AccumulateOutput =  { ok: OpaqueHash | null };

export interface AccumulateState { 
    slot: number,
    entropy: Entropy, // 32 bytes
    ready_queue: ReadyQueue,
    accumulated: AccumulatedQueue,
    privileges: Privileges,
    accounts: Accounts,
}



export interface Privileges {
    bless: ServiceId,
    assign: ServiceId,
    designate: ServiceId,
    always_acc: AlwaysAccumulateMapEntry[], 
}

export interface SingleReportItem {
    report: Report;
    dependencies: OpaqueHash[]; // discriminator is the length of the array
}

export type AlwaysAccumulateMapEntry = {
    id: ServiceId, // u32
    gas: Gas // u64
}

//------ Ready Queue ------
export type ReadyQueue = ReadyQueueItem[];  

export type ReadyQueueItem = ReadyRecord[];

export interface ReadyRecord {
    report: Report,
    dependencies: WorkPackageHashes; // discriminator is the length of the array
}

export type WorkPackageHashes = WorkPackageHash[];
// ------------------------


// -------- Accumulated Queue --------
export type AccumulatedQueue = AccumulatedQueueItem[];

export type AccumulatedQueueItem = WorkPackageHash[];

// -----------------------------------


export interface AccumulateStf {
    input: AccumulateInput,
    pre_state: AccumulateState,
    output: AccumulateOutput,
    post_state: AccumulateState
}



export type  Accounts = AccountItem[];

export interface AccountItem {
    id: AccountId;  // u32
    data: AccountData;
}

export interface AccountData {
    service: ServiceInfo,
    preimages: Preimages,
}

export type Preimages =  PreimageItem[]; 

export interface PreimageItem {
    hash: OpaqueHash,
    blob: Uint8Array,
} 

export interface ServiceInfo {
    code_hash: Uint8Array; // 32 bytes
    balance: number;       // u64
    min_item_gas: number;   // u32
    min_memo_gas: number;   // u32
    bytes: number;         // u64
    items: number;      // u32
}

