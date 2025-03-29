import { hexStringToBytes } from "../../../../codecs";
import { Result } from "../../../../types";
import { Assignment } from "../../../disputes/types";
import { AssurancesInput, ErrorCode, Output, ValidatorInfo } from "../../../types";
import { Assurances, AssuranceState } from "../../types";


/**
 * parseAssurancesStfJson:
 *   Reads a big JSON object of the shape:
 *   {
 *     "input": {...},
 *     "pre_state": {...},
 *     "output": {...},
 *     "post_state": {...}
 *   }
 *   and returns a fully typed Assurances object.
 */
export function parseAssurancesStfJson(raw: any): Assurances {
    // We can log the raw JSON if we like, but be mindful of console clutter.
    // console.log("parseAssurancesStfJson: raw = ", raw);
    return {
      input: parseAssurancesInputJson(raw.input),
      pre_state: parseAssurancesStateJson(raw.pre_state),
      output: parseAssurancesOutputJson(raw.output),
      post_state: parseAssurancesStateJson(raw.post_state),
    };
  }

  
/**
 * parseAssurancesInputJson:
 *   Converts a raw JSON for the Assurances input section into a typed AssurancesInput object.
 */
function parseAssurancesInputJson(raw: any): AssurancesInput {
  const parseSingleAssurance = (ass: any) => ({
    anchor: hexStringToBytes(ass.anchor),
    bitfield: hexStringToBytes(ass.bitfield),
    validator_index: ass.validator_index,
    signature: hexStringToBytes(ass.signature),
  });

  return {
    assurances: raw.assurances.map(parseSingleAssurance),
    slot: raw.slot,
    parent: hexStringToBytes(raw.parent),
  };
}

/**
 * parseAssignmentJson:
 *   Converts a single assignment JSON into a typed Assignment object (or null if not present).
 */
function parseAssignmentJson(rawAssignment: any): Assignment | null {
  if (!rawAssignment) {
    return null;
  }

  const parseReportResult = (r: any): Result => ({
    service_id: r.service_id,
    code_hash: hexStringToBytes(r.code_hash),
    payload_hash: hexStringToBytes(r.payload_hash),
    accumulate_gas: r.accumulate_gas,
    result: r.result.ok
      ? { ok: hexStringToBytes(r.result.ok) }
      : { panic: null },
      refine_load: {
        gas_used: r.refine_load.gas_used,
        imports: r.refine_load.imports,
        extrinsic_count: r.refine_load.extrinsic_count,
        extrinsic_size: r.refine_load.extrinsic_size,
        exports: r.refine_load.exports,
    }, 
  });

  return {
    report: {
      package_spec: {
        hash: hexStringToBytes(rawAssignment.report.package_spec.hash),
        length: rawAssignment.report.package_spec.length,
        erasure_root: hexStringToBytes(rawAssignment.report.package_spec.erasure_root),
        exports_root: hexStringToBytes(rawAssignment.report.package_spec.exports_root),
        exports_count: rawAssignment.report.package_spec.exports_count,
      },
      context: {
        anchor: hexStringToBytes(rawAssignment.report.context.anchor),
        state_root: hexStringToBytes(rawAssignment.report.context.state_root),
        beefy_root: hexStringToBytes(rawAssignment.report.context.beefy_root),
        lookup_anchor: hexStringToBytes(rawAssignment.report.context.lookup_anchor),
        lookup_anchor_slot: rawAssignment.report.context.lookup_anchor_slot,
        prerequisites: rawAssignment.report.context.prerequisites.map((p: string) =>
          hexStringToBytes(p)
        ),
      },
      core_index: rawAssignment.report.core_index,
      authorizer_hash: hexStringToBytes(rawAssignment.report.authorizer_hash),
      auth_output: hexStringToBytes(rawAssignment.report.auth_output),
      segment_root_lookup: rawAssignment.report.segment_root_lookup.map((s: string) =>
        hexStringToBytes(s)
      ),
      results: rawAssignment.report.results.map(parseReportResult),
        auth_gas_used: rawAssignment.report.auth_gas_used,
    },
    timeout: rawAssignment.timeout,
  };
}

/**
 * parseValidatorsJson:
 *   Converts an array of validator JSON objects into typed ValidatorInfo objects.
 */
function parseValidatorsJson(vals: any[]): ValidatorInfo[] {
  return vals.map((validator: any) => ({
    bandersnatch: hexStringToBytes(validator.bandersnatch),
    ed25519: hexStringToBytes(validator.ed25519),
    bls: hexStringToBytes(validator.bls),
    metadata: hexStringToBytes(validator.metadata),
  }));
}

/**
 * parseAssurancesStateJson:
 *   Converts a raw pre_state or post_state JSON into a typed AssurancesState object.
 */
function parseAssurancesStateJson(rawState: any): AssuranceState {
  return {
    avail_assignments: rawState.avail_assignments.map(parseAssignmentJson),
    curr_validators: parseValidatorsJson(rawState.curr_validators),
  };
}

/**
 * parseAssurancesOutputJson:
 *   Converts a raw output JSON which could be { "err": "..."} or { "ok": {...}} into AssurancesOutput.
 */
function parseAssurancesOutputJson(rawOut: any): Output {
  if (rawOut.err) {
    // Convert something like "bad-anchor" => ErrorCode.BAD_ANCHOR (assuming we have an enum or mapping)
    const mappedErr = ErrorCode[rawOut.err.toUpperCase().replace(/-/g, "_") as keyof typeof ErrorCode];
    if (mappedErr === undefined) {
      throw new Error(`parseAssurancesOutputJson: unknown err code '${rawOut.err}'`);
    }
    return { err: mappedErr };
  }

  if (rawOut.ok) {
    // parse { "reported": [...reports...] }
    const parseReportResult = (r: any): Result => ({
      service_id: r.service_id,
      code_hash: hexStringToBytes(r.code_hash),
      payload_hash: hexStringToBytes(r.payload_hash),
      accumulate_gas: r.accumulate_gas,
      result: r.result.ok
        ? { ok: hexStringToBytes(r.result.ok) }
        : { panic: null },
    refine_load: {
        gas_used: r.refine_load.gas_used,
        imports: r.refine_load.imports,
        extrinsic_count: r.refine_load.extrinsic_count,
        extrinsic_size: r.refine_load.extrinsic_size,
        exports: r.refine_load.exports,
        }, 
    });

    const parseReported = (rep: any) => ({
      package_spec: {
        hash: hexStringToBytes(rep.package_spec.hash),
        length: rep.package_spec.length,
        erasure_root: hexStringToBytes(rep.package_spec.erasure_root),
        exports_root: hexStringToBytes(rep.package_spec.exports_root),
        exports_count: rep.package_spec.exports_count,
      },
      context: {
        anchor: hexStringToBytes(rep.context.anchor),
        state_root: hexStringToBytes(rep.context.state_root),
        beefy_root: hexStringToBytes(rep.context.beefy_root),
        lookup_anchor: hexStringToBytes(rep.context.lookup_anchor),
        lookup_anchor_slot: rep.context.lookup_anchor_slot,
        prerequisites: rep.context.prerequisites.map((p: string) =>
          hexStringToBytes(p)
        ),
      },
      core_index: rep.core_index,
      authorizer_hash: hexStringToBytes(rep.authorizer_hash),
      auth_output: hexStringToBytes(rep.auth_output),
      segment_root_lookup: rep.segment_root_lookup.map((s: string) =>
        hexStringToBytes(s)
      ),
      results: rep.results.map(parseReportResult),
      auth_gas_used: rep.auth_gas_used,
      
    });

    return {
      ok: {
        reported: rawOut.ok.reported.map(parseReported),
      },
    };
  }

  throw new Error("parseAssurancesOutputJson: must have either 'err' or 'ok' in output");
}


