import { hexStringToBytes } from "../../../codecs";
import { Context, ExtrinsicData, PackageSpec, RefineLoad, Report, Result, ResultValue, ServiceActivityRecord, ServicesStatisticsMapEntry } from "../../../types/types";
import { parseReportJson } from "../../../utils/parsers";
import { CoresActivityRecord } from "../../reports/types";
import { ValidatorInfo } from "../../types";
import { Statistics, StatsExtrinsic } from "../types";
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
    blocks: json.blocks,
    tickets: json.tickets,
    pre_images: json.pre_images,
    pre_images_size: json.pre_images_size,
    guarantees: json.guarantees,
    assurances: json.assurances,
  };
}
function parseCoresRecordJson(json: any): CoresActivityRecord {
  return {
    gas_used: json.gas_used,
    imports: json.imports,
    extrinsic_count: json.extrinsic_count,
    extrinsic_size: json.extrinsic_size,
    exports: json.exports,
    bundle_size: json.bundle_size,
    da_load: json.da_load,
    popularity: json.popularity,
  }
}

function parseStatisticsJson(json: any): Statistics {
  const vals_current = (json.vals_current || []).map(parsePerformanceRecordJson);
  const vals_last = (json.vals_last || []).map(parsePerformanceRecordJson);
  const cores = (json.cores || []).map(parseCoresRecordJson);
  const services = (json.services || []).map(parseServicesRecordJson);
  return { vals_current, vals_last, cores, services };
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
    statistics: parseStatisticsJson(json.statistics || {}),
    slot: json.slot,
    curr_validators: (json.curr_validators || []).map(parseValidatorDataJson),
  };
}

function parseServiceActivityRecord(json: any): ServiceActivityRecord {
  return {
    provided_count: json.provided_count, 
    provided_size: json.provided_size, 
    refinement_count: json.refinement_count,
    refinement_gas_used: json.refinement_gas_used, 
    imports: json.imports,
    extrinsic_count: json.extrinsic_count,
    extrinsic_size: json.extrinsic_size, 
    exports: json.exports, 
    accumulate_count: json.accumulate_count,
    accumulate_gas_used: json.accumulate_gas_used,
    on_transfers_count: json.on_transfers_count, 
    on_transfers_gas_used: json.on_transfers_gas_used
  }

}
function parseServicesRecordJson(json: any): ServicesStatisticsMapEntry {
  return {
    id: json.id,
    record: parseServiceActivityRecord(json.record || {}),
  }
}