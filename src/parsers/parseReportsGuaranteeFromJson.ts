import { hexStringToBytes, toUint8Array } from "../codecs/utils";
import { Report, Guarantee, PackageSpec, Context } from "../types/types";

export function parseReportFromJson(r: any): Report {
    return {
      package_spec: {
        hash: hexStringToBytes(r.package_spec.hash),      
        length: r.package_spec.length,
        erasure_root: hexStringToBytes(r.package_spec.erasure_root),
        exports_root: hexStringToBytes(r.package_spec.exports_root),
        exports_count: r.package_spec.exports_count,
      },
      context: {
        anchor:     hexStringToBytes(r.context.anchor),
        state_root: hexStringToBytes(r.context.state_root),
        beefy_root:    hexStringToBytes(r.context.beefy_root),
        lookup_anchor: hexStringToBytes(r.context.lookup_anchor),
        lookup_anchor_slot: r.context.lookup_anchor_slot,
        prerequisites: (r.context.prerequisites || []).map((p: string) => 
          hexStringToBytes(p)
        ),
      },
      core_index: r.core_index,
      authorizer_hash: hexStringToBytes(r.authorizer_hash),
      auth_output: hexStringToBytes(r.auth_output),
      segment_root_lookup: (r.segment_root_lookup || []).map((seg: string) => 
        hexStringToBytes(seg)
      ),
      results: (r.results || []).map((item: any) => ({
        service_id: item.service_id,
        code_hash:   hexStringToBytes(item.code_hash),
        payload_hash:  hexStringToBytes(item.payload_hash),
        accumulate_gas: item.accumulate_gas,
        result: (() => {
          if (item.result.ok != null) {
            return { ok: Uint8Array.from(Buffer.from(item.result.ok.slice(2), "hex")) };
          } else if (item.result.panic != null) {
            return { panic: null };
          } else {
            return { placeholder: null };
          }
        })(),
      }))
    };
  }

  export function parseGuarantee(g: any): Guarantee {
    return {
      report: parseReportFromJson(g.report),
      slot: g.slot,
      signatures: (g.signatures || []).map((sigObj: any) => ({
        validator_index: sigObj.validator_index,
        signature: hexStringToBytes(sigObj.signature)  
      }))
    };
  }