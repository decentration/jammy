import { PreimagesStf, PreimagesInput, PreimagesOutput, PreimagesState } from "../types";
import { Preimage, PreimagesMapEntry, LookupMetaMapEntry, LookupMetaMapKey, Account, AccountsMapEntry } from "../types";
import { hexStringToBytes } from "../../../codecs"; // or wherever your hex-to-bytes util is

/**
 * parsePreimagesStfJson:
 *   Converts the raw JSON for a Preimages STF test case into a PreimagesStf object.
 */
export function parsePreimagesStfJson(json: any): PreimagesStf {
  return {
    input: parsePreimagesInputJson(json.input),
    pre_state: parsePreimagesStateJson(json.pre_state),
    output: parsePreimagesOutputJson(json.output),
    post_state: parsePreimagesStateJson(json.post_state),
  };
}


export function parsePreimagesInputJson(json: any): PreimagesInput {
  if (!json) {
    throw new Error("parsePreimagesInputJson: missing input JSON");
  }

  const preimages = (json.preimages || []).map((p: any) => parsePreimageJson(p));
  const slot = json.slot || 0;

  return { preimages, slot };
}

function parsePreimageJson(json: any): Preimage {
  return {
    requester: json.requester || 0,
    blob: json.blob ? hexStringToBytes(json.blob) : new Uint8Array(),
  };
}

export function parsePreimagesStateJson(json: any): PreimagesState {
  if (!json) {
    return { accounts: [] };
  }
  const accounts = (json.accounts || []).map((accJson: any) =>
    parseAccountsMapEntryJson(accJson)
  );
  return { accounts };
}

function parseAccountsMapEntryJson(json: any): AccountsMapEntry {
  return {
    id: json.id || 0,
    data: parseAccountJson(json.data),
  };
}

function parseAccountJson(json: any): Account {
  if (!json) {
    return {
      preimages: [],
      lookup_meta: [],
    };
  }

  const preimages = (json.preimages || []).map((p: any) => parsePreimagesMapEntryJson(p));
  const lookup_meta = (json.lookup_meta || []).map((lm: any) => parseLookupMetaMapEntryJson(lm));

  return {
    preimages,
    lookup_meta,
  };
}

function parsePreimagesMapEntryJson(json: any): PreimagesMapEntry {
  return {
    hash: json.hash ? hexStringToBytes(json.hash) : new Uint8Array(),
    blob: json.blob ? hexStringToBytes(json.blob) : new Uint8Array(),
  };
}

function parseLookupMetaMapEntryJson(json: any): LookupMetaMapEntry {
  return {
    key: parseLookupMetaMapKeyJson(json.key),
    value: (json.value || []).map((slot: any) => slot >>> 0), 
  };
}

function parseLookupMetaMapKeyJson(json: any): LookupMetaMapKey {
  if (!json) {
    return {
      hash: new Uint8Array(32),
      length: 0,
    };
  }
  return {
    hash: json.hash ? hexStringToBytes(json.hash) : new Uint8Array(32),
    length: json.length || 0,
  };
}

export function parsePreimagesOutputJson(json: any): PreimagesOutput {
  if (!json) {
    return { ok: null };
  }

  if (json.ok !== undefined) {
    return { ok: null };
  } else if (json.err !== undefined) {
    return { err: json.err };
  }

  return { ok: null };
}
