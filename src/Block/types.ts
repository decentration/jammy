import { Struct, u8, u16, u32, u64,  Bytes, Vector, Enum, Codec,  bool, _void} from 'scale-ts';
import { DiscriminatorCodec, SetCodec } from '../codecs';
import { SingleByteLenCodec } from '../codecs/SingleByteLenCodec';
import { ResultValueCodec, ReportCodec } from './codecs';


export const BandersnatchSignatureCodec = Bytes(784); 
export const Ed25519SignatureCodec = Bytes(64); 

export type BandersnatchSignature = Uint8Array; // 784 bytes
export type Ed25519Signature = Uint8Array; // "

export interface Ticket {
  attempt: number; // u8
  signature: BandersnatchSignature; // bandersnatch signature under context XT;   
}

export const TicketCodec = Struct({
  attempt: u8,
  signature: BandersnatchSignatureCodec, // $jam_ticket_seal (XT)
});

export interface Preimage {
  requester: number; // u32
  blob: Uint8Array;
}

export const PreimageCodec = Struct({
  requester: u32,
  blob: SingleByteLenCodec,
});

export interface Assurance {
  anchor: Uint8Array; // Bytes(32)
  bitfield: Uint8Array;
  validator_index: number; // u16
  signature: Ed25519Signature; // Ed25519 signature under context XA
}

const bitfieldLength = 1; // understanding GP 11.2.1 

export const AssuranceCodec = Struct({
  anchor: Bytes(32),
  bitfield: Bytes(bitfieldLength),  
  validator_index: u16,
  // Context: $jam_available (XA)
  signature: Ed25519SignatureCodec,
});

export interface Result {
  service_id: number; // 
  code_hash: Uint8Array; // Bytes(32)
  payload_hash: Uint8Array; // Bytes(32)
  accumulate_gas: number; // u32
  result: ResultValue;
}

// the result value is an enum with variants.
export type ResultValue =
| { ok: Uint8Array }
| { panic: null }
| { placeholder: null }

// export const ResultValueCodec = Enum({
//   ok: SingleByteLenCodec,
//   placeholder: _void, // not sure what else goes as enums. adding placeholder. 
//   panic: _void,
// });


// export const ResultCodec = Struct({
//   service_id: u32,
//   code_hash: Bytes(32),
//   payload_hash: Bytes(32),
//   accumulate_gas: u32, // 4 byte little endian integer
//   result: ResultValueCodec,
// });

export interface PackageSpec {
  hash: Uint8Array; // Bytes(32)
  length: number; // u32
  erasure_root: Uint8Array; // Bytes(32)
  exports_root: Uint8Array; // Bytes(32)
  exports_count: number; // u16
}

export const PackageSpecCodec = Struct({
  hash: Bytes(32),
  length: u32, // 4 bytes
  erasure_root: Bytes(32),
  exports_root: Bytes(32),
  exports_count: u16,
});

export interface Context {
  anchor: Uint8Array; 
  state_root: Uint8Array;
  beefy_root: Uint8Array;
  lookup_anchor: Uint8Array;
  lookup_anchor_slot: number; // u32
  prerequisites: Uint8Array[]; // Array of Bytes(32)
}

export const ContextCodec = Struct({
  anchor: Bytes(32),
  state_root: Bytes(32),
  beefy_root: Bytes(32),
  lookup_anchor: Bytes(32),
  lookup_anchor_slot: u32,
  prerequisites: Vector(Bytes(32)),
});

export interface Report {
  package_spec: PackageSpec;
  context: Context;
  core_index: number; // u32
  authorizer_hash: Uint8Array; // Bytes(32)
  auth_output: Uint8Array;
  segment_root_lookup: Uint8Array[]; // Array of Bytes(32)
  results: Result[];
}

// export const ReportCodec = Struct({
//   package_spec: PackageSpecCodec,
//   context: ContextCodec,
//   core_index: u16,
//   authorizer_hash: Bytes(32),
//   auth_output: SingleByteLenCodec,
//   segment_root_lookup: Vector(Bytes(32)),
//   results: DiscriminatorCodec(ResultCodec),
// });

export interface Signature {
  validator_index: number; // u16
  signature: Ed25519Signature; // Ed25519 signature under context XG
}

export const SignatureCodec = Struct({
  validator_index: u16,
  signature: Ed25519SignatureCodec, // Context: $jam_guarantee (XG)
});

export interface Guarantee {
  report: Report;
  slot: number; // u32
  signatures: Signature[];
}

// export const GuaranteeCodec = Struct({
//   report: ReportCodec,
//   slot: u32,
//   signatures: DiscriminatorCodec(SignatureCodec),
// });

export interface Verdict {
  target: Uint8Array; // Bytes(32)
  age: number; // u32
  votes: Vote[];
}

export interface Vote {
  vote: boolean;
  index: number; // u16
  signature: Ed25519Signature; // Ed25519 signature under context X⊺ or X depending on vote
}

export const VoteCodec = Struct({
  vote: bool, // 0 or 1
  index: u16,
  // Context: $jam_valid (X⊺) if vote is true, $jam_invalid (X) if vote is false
  signature: Ed25519SignatureCodec,
});

// export const VerdictCodec = Struct({
  
//   target: Bytes(32),
//   age: u32, // fixed 4 byte length little endian integer
//   votes: SetCodec(VoteCodec, 67),
// })


// Updated Culprit interface and codec
export interface Culprit {
  target: Uint8Array; // Bytes(32) Work Report Hash
  key: Uint8Array; // Bytes(32)
  signature: Ed25519Signature; // Bandersnatch signature under context XU
}

export const CulpritCodec = Struct({
  target: Bytes(32),
  key: Bytes(32),
  // Context: $jam_audit (XU)
  signature: Ed25519SignatureCodec,
});

export interface Fault {
  target: Uint8Array; // Bytes(32)
  vote: boolean;
  key: Uint8Array; // Bytes(32)
  signature: Ed25519Signature; // Ed25519 signature under context XG
}

export const FaultCodec = Struct({
  target: Bytes(32),
  vote: bool, 
  key: Bytes(32),
  // Context: $jam_guarantee (XG)
  signature: Ed25519SignatureCodec,
});

export interface Dispute {


  // verdicts 
  verdicts: Verdict[];
  culprits: Culprit[];
  faults: Fault[];
}

// export const DisputeCodec = Struct({
//   verdicts: DiscriminatorCodec(VerdictCodec),
//   culprits: DiscriminatorCodec(CulpritCodec),
//   faults: DiscriminatorCodec(FaultCodec),
// });

// The signing contexts are:

// - **XA** = `$jam_available`: **Ed25519** for availability assurances.
// - **XB** = `$jam_beefy`: **BLS** for accumulate-result-root-MMR commitment.
// - **XE** = `$jam_entropy`: On-chain entropy generation.
// - **XF** = `$jam_fallback_seal`: **Bandersnatch** for fallback block seal.
// - **XG** = `$jam_guarantee`: **Ed25519** for guarantee statements.
// - **XI** = `$jam_announce`: **Ed25519** for audit announcement statements.
// - **XT** = `$jam_ticket_seal`: **Bandersnatch** for RingVRF ticket generation and regular block seal.
// - **XU** = `$jam_audit`: **Bandersnatch** for audit selection entropy.
// - **X⊺** = `$jam_valid`: **Ed25519** for judgments of valid work reports.
// - **X** = `$jam_invalid`: **Ed25519** for judgments of invalid work reports.