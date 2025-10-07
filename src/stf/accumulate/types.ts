import { Bytes, Codec, u32 } from "scale-ts";
import { Gas, OpaqueHash, Report, ServicesStatisticsMapEntry } from "../../types";
import { Entropy } from "../reports/types";
import { ServiceInfo } from "../types";
import { Statistics } from "../statistics/types";

export type ServiceId = number; // u32
export type AccountId = number; // u32
export type WorkPackageHash = OpaqueHash; 
export type WorkReportHash = OpaqueHash;

export const AccountIdCodec = u32;
export const WorkPackageHashCodec = Bytes(32);

export type Reports = Report[]; 

export interface AccumulateInput { 
    slot: number,
    reports: Reports, 
}

export type AccumulateOutput =  { ok: OpaqueHash | null };

export type ServicesStatistics = ServicesStatisticsMapEntry[];

export interface AccumulateState { 
    slot: number,
    entropy: Entropy, // 32 bytes
    ready_queue: ReadyQueue,
    accumulated: AccumulatedQueue,
    privileges: Privileges,
    statistics: ServicesStatistics,
    accounts: Accounts,
}

export type AssignArray = ServiceId[]; // must be of fixed size cores count. 
export interface Privileges {
    bless: ServiceId,
    assign: AssignArray,
    designate: ServiceId,
    register: ServiceId, // TODO add to accumulate pipeline logic
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

// -----------------------------------


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


// StorageMapEntry ::= SEQUENCE {
//     -- Storage key (unhashed, as managed by the service code)
//     key ByteSequence,
//     -- Storage value
//     value ByteSequence
// }

export type StorageMap = StorageMapEntry[];
export interface StorageMapEntry {
    key: Uint8Array,
    value: Uint8Array,
}
export interface AccountData {
    service: ServiceInfo,
    storage: StorageMap, // TODO apply to accumulate pipeline logic 
    preimages_blob: PreimagesBlob, // TODO apply to accumulate pipeline logic 
    preimages_status: PreimagesStatus, // TODO apply to accumulate pipeline logic 
}

export type PreimagesBlob =  PreimagesBlobItem[]; 

export interface PreimagesBlobItem {
    hash: OpaqueHash,
    blob: Uint8Array,
} 

export type PreimagesStatus = PreimagesStatusItem[];

export interface PreimagesStatusItem {
    hash: OpaqueHash,
    status: number[],  // sequence of u32s TimeSlots between 0 and 3
}





//----


export interface CodeUpgrade {
    serviceId: number; // u32
    newCodeHash: Uint8Array; // 32 bytes
}
export interface NewService {
    serviceId: number; // u32
    codeHash: Uint8Array; // 32 bytes
}

export interface NewTransfer {
    src: number; // u32
    dest: number; // u32
    amount: bigint; // u64
}

export interface AccumulateEphemeral {
    newTransfers?: NewTransfer[];
    newServices?: NewService[];
    codeUpgrades?: CodeUpgrade[];
    selfTerminated?: boolean;
    commitmentHash?: string; 
    actualGasUsed?: Gas;
  }
  
  
  