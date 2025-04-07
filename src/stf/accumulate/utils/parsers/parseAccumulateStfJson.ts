import { hexStringToBytes } from "../../../../codecs";
import { parseReportJson } from "../../../../utils/parsers"; 
import {
  AccumulateStf,
  AccumulateInput,
  AccumulateOutput,
  AccumulateState,
  Privileges,
  AlwaysAccumulateMapEntry,
  ReadyQueue,
  ReadyRecord,
  AccumulatedQueue,
  AccumulatedQueueItem,
  AccountItem,
  AccountData,
} from "../../types";


export function parseAccumulateStfJson(json: any): AccumulateStf {
  return {
    input: parseAccumulateInputJson(json.input || {}),
    pre_state: parseAccumulateStateJson(json.pre_state || {}),
    output: parseAccumulateOutputJson(json.output || {}),
    post_state: parseAccumulateStateJson(json.post_state || {}),
  };
}


function parseAccumulateInputJson(json: any): AccumulateInput {
  return {
    slot: json.slot || 0,
    reports: (json.reports || []).map((r: any) => parseReportJson(r)),
  };
}


function parseAccumulateOutputJson(json: any): AccumulateOutput {
  return {
    ok: hexStringToBytes(json.ok ?? "0x"),
  };
}


function parseAccumulateStateJson(json: any): AccumulateState {
  return {
    slot: json.slot || 0,
    entropy: hexStringToBytes(json.entropy || "0x"), // 32 bytes
    ready_queue: parseReadyQueueJson(json.ready_queue || []),
    accumulated: parseAccumulatedQueueJson(json.accumulated || []),
    privileges: parsePrivilegesObject(json.privileges || []),
    accounts: parseAccountItemsJson(json.accounts || []),
  };
}

function parseReadyQueueJson(json: any[]): ReadyQueue {
  return json.map((item) => item.map(parseReadyRecordJson));
  
}

// export interface ReadyRecord {
//     report: Report,
//     dependencies: WorkPackageHash[]; // discriminator is the length of the array
// }


function parseReadyRecordJson(json: any): ReadyRecord {
  return {
    report: parseReportJson(json.report || {}),
    dependencies: (json.dependencies || []).map((dep: string) => hexStringToBytes(dep)),
  };
}


function parseAccumulatedQueueJson(json: any[]): AccumulatedQueue {
  return json.map(parseAccumulatedQueueItemJson);
}

function parseAccumulatedQueueItemJson(item: any[]): AccumulatedQueueItem {
  return item.map((hash: string) => hexStringToBytes(hash));
}


function parsePrivilegesObject(obj: any): Privileges {
    return {
      bless: obj.bless || 0,
      assign: obj.assign || 0,
      designate: obj.designate || 0,
      always_acc: parseAlwaysAccumulateMapEntryJson(obj.always_acc || []),
    };
  }

function parseAlwaysAccumulateMapEntryJson(json: any[]): AlwaysAccumulateMapEntry[] {
  return json.map((entry) => ({
    id: entry.id || 0,
    gas: entry.gas || 0,
  }));
}


function parseAccountItemsJson(json: any[]): AccountItem[] {
    console.log("parseAccountItemsJson", json);
  return json.map(parseServiceItemJson);
}

function parseServiceItemJson(obj: any): AccountItem {
  return {
    id: obj.id || 0,
    data: parseServiceInfoJson(obj.data || {}),
 };
}


function parseServiceInfoJson(obj: any): AccountData {
    if (!obj) {
      throw new Error("Invalid service info object");
    }
  return {
    service: {
      code_hash: hexStringToBytes(obj.service.code_hash || "0x"),
      balance: obj.service.balance || 0,
      min_item_gas: obj.service.min_item_gas || 0,
      min_memo_gas: obj.service.min_memo_gas || 0,
      bytes: obj.service.bytes || 0,
      items: obj.service.items || 0,
    },
    preimages: (obj.preimages || []).map((p: any) => ({
        hash: hexStringToBytes(p.hash || "0x"),
        blob: hexStringToBytes(p.blob || "0x"),

    })),
  };
}
