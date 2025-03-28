import { Struct, u8, u16, u32, Bytes, Vector, bool, _void, Codec, u64} from 'scale-ts';
import { VarLenBytesCodec } from '../codecs';
import { BITFIELD_LENGTH } from '../consts';
import { EpochMark } from '../stf/safrole/types';

export const BandersnatchRingVrfSignatureCodec = Bytes(784); 
export const BandersnatchVrfSignaturesCodec = Bytes(96);
export const BandersnatchPublicCodec = Bytes(32);
export const OpaqueHashCodec = Bytes(32);
export const BlsPublicCodec = Bytes(144);
export const Ed25519SignatureCodec = Bytes(64); 
export const Ed25519PublicCodec = Bytes(32);
export const ValidatorMetadataCodec = Bytes(128)
export const ServiceIdCodec = u32;
export const BandersnatchRingRootCodec = Bytes(144);
export const EpochMarkValidatorsCodec = Struct({
  bandersnatch: BandersnatchPublicCodec,
  ed25519: Ed25519PublicCodec,
});

export type OpaqueHash = Uint8Array; // 32 bytes  
export type BandersnatchRingVrfSignature = Uint8Array; // 784 byte
export type BandersnatchVrfSignatures = Uint8Array; // 96 Bytes
export type BandersnatchPublic = Uint8Array; // 32 bytes
export type BlsPublic = Uint8Array; // 144 bytes
export type Ed25519Signature = Uint8Array; // 64 bytes
export type Ed25519Public = Uint8Array; // 32 bytes
export type ValidatorMetadata = Uint8Array; // 128 bytes  
export type ServiceId = number; // u32  
export type BandersnatchRingRoot = Uint8Array; // 144 bytes
export type EpochMarkValidators = {
  bandersnatch: BandersnatchPublic;
  ed25519: Ed25519Public;
}; // 64 bytes



export interface Validators {
  public_key: BandersnatchPublic; // 32 bytes
  stake: number; // u64
}
// export interface EpochMark {
//   entropy: Uint8Array; // η1'
//   tickets_entropy: Uint8Array; // η2'
//   validators: Uint8Array[]; // [kb | k ∈ γk'] // 32 bytes bandersnatch public keys of VALIDATORS_COUNT
// }

export type TicketsMark = {
  id: Uint8Array; // Bytes(32)
  attempt: number; // u8
}

export type OffendersMark = Uint8Array; // Bytes(32)
  

export interface Header {
  parent: Uint8Array;             // Hp: Parent hash
  parent_state_root: Uint8Array;         // Hr: Prior state root
  extrinsic_hash: Uint8Array;          // Hx: Extrinsic hash
  slot: number;          // Ht: Time-slot index
  epoch_mark: EpochMark | null;                // He: Epoch marker 
  tickets_mark: TicketsMark[] | null;    // Hw: Winning-tickets apparent when epoch mark is null
  offenders_mark: OffendersMark[];            // Ho: Offenders
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

// export const PreimageCodec = Struct({
//   requester: u32,
//   blob: VarLenBytesCodec,
// });

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

// gas-used U64,
// imports U16,
// extrinsic-count U16,
// extrinsic-size U32,
// exports U16

export interface RefineLoad {
  gas_used: number; // u64
  imports: number; // u16
  extrinsic_count: number; // u16
  extrinsic_size: number; // u32
  exports: number; // u16
}


export interface Result {
  service_id: number; // 
  code_hash: Uint8Array; // Bytes(32)
  payload_hash: Uint8Array; // Bytes(32)
  accumulate_gas: number; // u64
  result: ResultValue;
  refine_load: RefineLoad;
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

// lets log inside the PackageSpecCodec 
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
  segment_root_lookup: SegmentItem[]; // Array of Bytes(32)
  results: Result[];
  auth_gas_used: number; // u64
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



export interface SegmentItem {
  work_package_hash: Uint8Array;  // Bytes(32)
  segment_tree_root: Uint8Array;  // Bytes(32)
}

export const ReportedPackageCodec = Struct({
  work_package_hash: Bytes(32),
  segment_tree_root: Bytes(32),
});

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

export type AuthorizerHash = Uint8Array;

export const AuthorizerHashCodec = Bytes(32);

export interface AvailAssignment {
  report: Report;
  timeout: number; // 4 bytes
}



  export interface CoresActivityRecord {
    gas_used: number,
    imports: number,
    extrinsic_count: number,
    extrinsic_size: number,
    exports: number, 
    bundle_size: number,
    da_load: number,
    popularity: number
  }

  export const CoreActivityRecordCodec = Struct({
    gas_used: u64,
    imports: u16,
    extrinsic_count: u16,
    extrinsic_size: u32,
    exports: u16,
    bundle_size: u32,
    da_load: u32,
    popularity: u16
  })



// ServiceActivityRecord ::= SEQUENCE {
// 	-- Number of preimages provided to this service.
// 	provided-count        U16,
// 	-- Total size of preimages provided to this service.
// 	provided-size         U32,
// 	-- Number of work-items refined by service for reported work.
// 	refinement-count      U32,
// 	-- Amount of gas used for refinement by service for reported work.
// 	refinement-gas-used   U64,
// 	-- Number of segments imported from the DL by service for reported work.
// 	imports               U32,
// 	-- Total number of extrinsics used by service for reported work.
// 	extrinsic-count       U32,
// 	-- Total size of extrinsics used by service for reported work.
// 	extrinsic-size        U32,
// 	-- Number of segments exported into the DL by service for reported work.
// 	exports               U32,
// 	-- Number of work-items accumulated by service.
// 	accumulate-count      U32,
// 	-- Amount of gas used for accumulation by service.
// 	accumulate-gas-used   U64,
// 	-- Number of transfers processed by service.
// 	on-transfers-count    U32,
// 	-- Amount of gas used for processing transfers by service.
// 	on-transfers-gas-used U64
// }


export interface ServiceActivityRecord {
  provided_count: number, 
  provided_size: number, 
  refinement_count: number,
  refinement_gas_used: number, 
  imports: number,
  extrinsic_count: number,
  extrinsic_size: number, 
  exports: number, 
  accumulate_count: number,
  accumulate_gas_used: number,
  on_transfers_count: number, 
  on_transfers_gas_used: number
}


export interface ServicesStatisticsMapEntry {
  id: number;
  record: ServiceActivityRecord;
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