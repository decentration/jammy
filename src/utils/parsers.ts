import { hexStringToBytes } from "../codecs";
import { Context, RefineLoad, Report, Result, ResultValue } from "../types";


export function parseReportJson(json: any): Report {


    return {
      package_spec: {
        hash: hexStringToBytes(json.package_spec.hash),
        length: json.package_spec.length,
        erasure_root: hexStringToBytes(json.package_spec.erasure_root),
        exports_root: hexStringToBytes(json.package_spec.exports_root),
        exports_count: json.package_spec.exports_count,
      },
      context: parseContextJson(json.context),
      core_index: json.core_index,
      authorizer_hash: hexStringToBytes(json.authorizer_hash),
      auth_output: hexStringToBytes(json.auth_output || "0x"), // might be empty
      segment_root_lookup: (json.segment_root_lookup || []).map((seg: any) => {
        return {
          segment_tree_root: hexStringToBytes(seg.segment_tree_root || "0x"),
          work_package_hash: hexStringToBytes(seg.work_package_hash || "0x"), 
          }
        }
      ),
      results: (json.results || []).map((res: any) => parseResultsRecordJson(res)),
      auth_gas_used: json.auth_gas_used,
      }
    }

  function parseResultsRecordJson(r: any): Result {
    return {
      service_id: r.service_id,
      code_hash: hexStringToBytes(r.code_hash),
      payload_hash: hexStringToBytes(r.payload_hash),
      accumulate_gas: r.accumulate_gas,
      result: parseResultValueRecordJson(r.result || {}),
      refine_load: parseRefineLoadRecordJson(r.refine_load || {}),
    }
  }


  function parseResultValueRecordJson(r: any): ResultValue {
    if (r.ok) {
      return { ok: Uint8Array.from(Buffer.from(r.ok.slice(2), "hex")) };
    } else if (r.panic != null) {
      return { panic: null };
    } else {
      return { placeholder: null };
    }
  }

  

  export function parseRefineLoadRecordJson(r: any): RefineLoad {
    return {
      gas_used: r.gas_used, // u64
      imports: r.imports, // u16
      extrinsic_count: r.extrinsic_count, // u16
      extrinsic_size: r.extrinsic_size, // u32
      exports: r.exports, // u16
      
    }
  }


  export function parseContextJson(json: any): (Context) {
    // if (!json) {
    //   return null;
    // }
    return {
      anchor: hexStringToBytes(json.anchor),
      state_root: hexStringToBytes(json.state_root),
      beefy_root: hexStringToBytes(json.beefy_root),
      lookup_anchor: hexStringToBytes(json.lookup_anchor),
      lookup_anchor_slot: json.lookup_anchor_slot,
      prerequisites: (json.prerequisites || []).map((p: any) => hexStringToBytes(p)),
    };
  }
  
