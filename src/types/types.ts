import { Struct, u8, u16, u32, Bytes, Vector, bool, _void} from 'scale-ts';
import { SingleByteLenCodec } from '../codecs/SingleByteLenCodec';
import { BITFIELD_LENGTH } from '../consts/tiny';

export const BandersnatchRingVrfSignatureCodec = Bytes(784); 
export const BandersnatchVrfSignaturesCodec = Bytes(96);
export const BandersnatchPublicCodec = Bytes(32);
export const OpaqueHashCodec = Bytes(32);
export const BlsPublicCodec = Bytes(144);
export const Ed25519SignatureCodec = Bytes(64); 
export const Ed25519PublicCodec = Bytes(32);
export const ValidatorMetadataCodec = Bytes(128)
export const ServiceIdCodec = u32;

export type OpaqueHash = Uint8Array; // 32 bytes  
export type BandersnatchRingVrfSignature = Uint8Array; // 784 byte
export type BandersnatchVrfSignatures = Uint8Array; // 96 Bytes
export type BandersnatchPublic = Uint8Array; // 32 bytes
export type BlsPublic = Uint8Array; // 144 bytes
export type Ed25519Signature = Uint8Array; // 64 bytes
export type Ed25519Public = Uint8Array; // 32 bytes
export type ValidatorMetadata = Uint8Array; // 128 bytes  
export type ServiceId = number; // u32  

export interface Validators {
  public_key: BandersnatchPublic; // 32 bytes
  stake: number; // u64
}
export interface EpochMark {
  entropy: Uint8Array; // η1'
  tickets_entropy: Uint8Array; // η2'
  validators: Uint8Array[]; // [kb | k ∈ γk'] // 32 bytes bandersnatch public keys
}

export interface TicketsMark {
  id: Uint8Array; // Bytes(32)
  attempt: number; // u8
}

export interface Header {
  parent: Uint8Array;             // Hp: Parent hash
  parent_state_root: Uint8Array;         // Hr: Prior state root
  extrinsic_hash: Uint8Array;          // Hx: Extrinsic hash
  slot: number;          // Ht: Time-slot index
  epoch_mark: EpochMark | null;                // He: Epoch marker 
  tickets_mark: TicketsMark[] | null;    // Hw: Winning-tickets apparent when epoch mark is null
  offenders_mark: Uint8Array[];            // Ho: Offenders
  author_index: number;       // Hi: Bandersnatch block author index u16
  entropy_source: Uint8Array;           // Hv: Entropy-yielding VRF signature
  seal: Uint8Array | null;              // Hs: Block seal
}

export interface Ticket {
  attempt: number; // u8
  signature: BandersnatchRingVrfSignature; // bandersnatch signature under context XT;   
}

export const TicketCodec = Struct({
  attempt: u8,
  signature: BandersnatchRingVrfSignatureCodec, // $jam_ticket_seal (XT)
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



export const AssuranceCodec = Struct({
  anchor: Bytes(32),
  bitfield: Bytes(BITFIELD_LENGTH), // understanding GP 11.2.1  
  validator_index: u16,
  // Context: $jam_available (XA)
  signature: Ed25519SignatureCodec,
});

export interface Result {
  service_id: number; // 
  code_hash: Uint8Array; // Bytes(32)
  payload_hash: Uint8Array; // Bytes(32)
  accumulate_gas: number; // u64
  result: ResultValue;
}

// the result value is an enum with variants.
export type ResultValue =
| { ok: Uint8Array }
| { panic: null }
| { placeholder: null }

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
  segment_root_lookup: SegmentLookupItem[]; // Array of Bytes(32)
  results: Result[];
}

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

export interface ExtrinsicData {
  tickets: Ticket[];
  preimages: Preimage[];
  guarantees: Guarantee[];
  assurances: Assurance[];
  disputes: Dispute;
}
export interface Block {
  header: Header;
  extrinsic: ExtrinsicData;
}



export interface SegmentLookupItem {
  work_package_hash: Uint8Array;  // Bytes(32)
  segment_tree_root: Uint8Array;  // Bytes(32)
}

export type Gas = number; // u64 
                         
export interface ImportSpec {
  tree_root: Uint8Array;  // 32 bytes
  index: number;          // u16
}

export interface ExtrinsicSpec {
  hash: Uint8Array; // 32 bytes
  len: number;      // u32
}

export interface WorkItem {
  service: number;                // u32
  code_hash: Uint8Array;          // 32 bytes
  payload: Uint8Array;            // single-byte-len-encoded
  refine_gas_limit: number;       // u64
  accumulate_gas_limit: number;   // u64
  import_segments: ImportSpec[];  // single-byte-len array
  extrinsic: ExtrinsicSpec[];     // single-byte-len array
  export_count: number;           // u16
}

export interface Authorizer {
  code_hash: Uint8Array; // 32 bytes
  params: Uint8Array;    // single-byte-len encoded
}

export interface WorkPackage {
  authorization: Uint8Array;  // single-byte-len encoded
  auth_code_host: number;     // u32
  authorizer: Authorizer;
  context: Context;          
  items: WorkItem[];          // single-byte-len array (size 1..4)
}



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