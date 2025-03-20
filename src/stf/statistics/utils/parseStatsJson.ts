import { hexStringToBytes } from "../../../codecs";
import { ExtrinsicData } from "../../../types/types";
import { ValidatorInfo } from "../../types";
import { StatsExtrinsic } from "../types";
import { StatsInput } from "../types";
import { StatsState, PerformanceRecord } from "../types";


export function parseStatsExtrinsicJson(json: any): ExtrinsicData {
  // 1) tickets
  const tickets = (json.tickets || []).map((t: any) => ({
    attempt: t.attempt,
    signature: t.signature ? hexStringToBytes(t.signature) : new Uint8Array()
  }));

  // 2) preimages
  const preimages = (json.preimages || []).map((p: any) => ({
    requester: p.requester,
    blob: p.blob ? hexStringToBytes(p.blob) : new Uint8Array()
  }));

  // 3) guarantees
  const guarantees = (json.guarantees || []).map((g: any) => ({
    report: parseReportJson(g.report),  
    slot: g.slot,
    signatures: (g.signatures || []).map((s: any) => ({
      validator_index: s.validator_index,
      signature: s.signature ? hexStringToBytes(s.signature) : new Uint8Array(),
    })),
  }));

  // 4) assurances
  const assurances = (json.assurances || []).map((a: any) => ({
    anchor: a.anchor ? hexStringToBytes(a.anchor) : new Uint8Array(),
    bitfield: a.bitfield ? hexStringToBytes(a.bitfield) : new Uint8Array(),
    validator_index: a.validator_index,
    signature: a.signature ? hexStringToBytes(a.signature) : new Uint8Array(),
  }));

  // 5) disputes
  const d = json.disputes || {};
  const disputes = {
    verdicts: (d.verdicts || []).map((vd: any) => ({
      target: vd.target ? hexStringToBytes(vd.target) : new Uint8Array(),
      age: vd.age || 0,
      votes: (vd.votes || []).map((v: any) => ({
        vote: v.vote || 0,
        index: v.index || 0,
        signature: v.signature ? hexStringToBytes(v.signature) : new Uint8Array(),
      })),
    })),
    culprits: (d.culprits || []).map((cp: any) => ({
      target: cp.target ? hexStringToBytes(cp.target) : new Uint8Array(),
      key: cp.key ? hexStringToBytes(cp.key) : new Uint8Array(),
      signature: cp.signature ? hexStringToBytes(cp.signature) : new Uint8Array(),
    })),
    faults: (d.faults || []).map((ft: any) => ({
      target: ft.target ? hexStringToBytes(ft.target) : new Uint8Array(),
      vote: ft.vote || 0,
      key: ft.key ? hexStringToBytes(ft.key) : new Uint8Array(),
      signature: ft.signature ? hexStringToBytes(ft.signature) : new Uint8Array(),
    })),
  };

  return { tickets, preimages, guarantees, assurances, disputes };
}

function parseReportJson(json: any): any {
    if (!json) {
      return null;
    }
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
      segment_root_lookup: (json.segment_root_lookup || []).map((seg: any) =>
        hexStringToBytes(seg)
      ),
      results: (json.results || []).map((r: any) => ({
        service_id: r.service_id,
        code_hash: hexStringToBytes(r.code_hash),
        payload_hash: hexStringToBytes(r.payload_hash),
        accumulate_gas: r.accumulate_gas,
        result: ((): any => {
            if (r.result.ok) {
              return { ok: Uint8Array.from(Buffer.from(r.result.ok.slice(2), "hex")) };
            } else if (r.result.panic != null) {
              return { panic: null };
            } else {
              return { placeholder: null };
            }
          })(),
      })),
    };
  }
  
  function parseContextJson(json: any): any {
    if (!json) {
      return null;
    }
    return {
      anchor: hexStringToBytes(json.anchor),
      state_root: hexStringToBytes(json.state_root),
      beefy_root: hexStringToBytes(json.beefy_root),
      lookup_anchor: hexStringToBytes(json.lookup_anchor),
      lookup_anchor_slot: json.lookup_anchor_slot,
      prerequisites: (json.prerequisites || []).map((p: any) => hexStringToBytes(p)),
    };
  }
  

export function parseStatsInputJson(json: any): StatsInput {
  return {
    slot: json.slot,
    author_index: json.author_index,
    extrinsic: parseStatsExtrinsicJson(json.extrinsic || {}),
  };
}

export function parseStatsOutputJson(json: any): null {
    if (json !== null) {
      console.warn("Expected output to be null, but got:", json);
    }
    return null;
  }
  
function parsePerformanceRecordJson(json: any): PerformanceRecord {
  return {
    blocks: json.blocks || 0,
    tickets: json.tickets || 0,
    pre_images: json.pre_images || 0,
    pre_images_size: json.pre_images_size || 0,
    guarantees: json.guarantees || 0,
    assurances: json.assurances || 0,
  };
}

function parseStatisticsJson(json: any) {
  const current = (json.current || []).map(parsePerformanceRecordJson);
  const last = (json.last || []).map(parsePerformanceRecordJson);
  return { current, last };
}

function parseValidatorDataJson(json: any): ValidatorInfo {
  return {
    bandersnatch: hexStringToBytes(json.bandersnatch || "0x"),
    ed25519: hexStringToBytes(json.ed25519 || "0x"),
    bls: hexStringToBytes(json.bls || "0x"),
    metadata: hexStringToBytes(json.metadata || "0x"),
  };
}

export function parseStatsStateJson(json: any): StatsState {
  return {
    pi: parseStatisticsJson(json.pi || {}),
    tau: json.tau,
    kappa_prime: (json.kappa_prime || []).map(parseValidatorDataJson),
  };
}
