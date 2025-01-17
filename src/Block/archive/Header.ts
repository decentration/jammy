


// import { Struct, Vector, u32, u16, Bytes, Option } from 'scale-ts';

// export interface EpochMark {
//   entropy: Uint8Array; // η1'
//   tickets_entropy: Uint8Array; // η2'
//   validators: Uint8Array[]; // [kb | k ∈ γk']
// }

// // export const EpochMarkCodec = Struct({
// //   entropy: Bytes(32),
// //   tickets_entropy: Bytes(32),
// //   validators: Vector(Bytes(32)),
// // });

// export interface Header {
//   parent: Uint8Array;             // Hp: Parent hash
//   parent_state_root: Uint8Array;         // Hr: Prior state root
//   extrinsic_hash: Uint8Array;          // Hx: Extrinsic hash
//   slot: number;          // Ht: Time-slot index
//   epoch_mark: EpochMark | null;                // He: Epoch marker
//   tickets_mark: Uint8Array[] | null;    // Hw: Winning-tickets
//   offenders_mark: Uint8Array[];            // Ho: Offenders
//   author_index: number;       // Hi: Bandersnatch block author index
//   entropy_source: Uint8Array;           // Hv: Entropy-yielding VRF signature
//   seal: Uint8Array | null;              // Hs: Block seal
// }

// export const HeaderCodec = Struct({
//   parent: Bytes(32),
//   parent_state_root: Bytes(32),
//   extrinsic_hash: Bytes(32),
//   slot: u32,
//   epoch_mark: Option(EpochMarkCodec),
//   tickets_mark: Option(Vector(Bytes(32))),
//   offenders_mark: Vector(Bytes(32)),
//   author_index: u16,
//   entropy_source: Bytes(96),
//   seal: Option(Bytes(96)),
// });

// // with seal
// export function serializeHeader(header: Header): Uint8Array {
//   return HeaderCodec.enc({
//     ...header,
//     epoch_mark: header.epoch_mark !== null ? header.epoch_mark : undefined,
//     tickets_mark: header.tickets_mark !== null ? header.tickets_mark : undefined,
//     seal: header.seal !== null ? header.seal : undefined,
//   });
// }

// //  without Seal
// export function serializeHeaderWithoutSeal(header: Header): Uint8Array {
//   const { ...headerWithoutSeal } = header;
//   return HeaderCodec.enc({
//     parent: headerWithoutSeal.parent,
//     parent_state_root: headerWithoutSeal.parent_state_root,
//     extrinsic_hash: headerWithoutSeal.extrinsic_hash,
//     slot: headerWithoutSeal.slot,
//     epoch_mark: headerWithoutSeal.epoch_mark ? headerWithoutSeal.epoch_mark : undefined,
//     tickets_mark: headerWithoutSeal.tickets_mark ? headerWithoutSeal.tickets_mark : undefined,
//     offenders_mark: headerWithoutSeal.offenders_mark || [],
//     author_index: headerWithoutSeal.author_index,
//     entropy_source: headerWithoutSeal.entropy_source,
//     seal: undefined,
//   });
// }

// export function deserializeHeader(data: Uint8Array): Header {
//   const decoded = HeaderCodec.dec(data);

//   return {
//     ...decoded,
//     epoch_mark: decoded.epoch_mark !== undefined ? decoded.epoch_mark : null,
//     tickets_mark: decoded.tickets_mark !== undefined ? decoded.tickets_mark : null,
//     offenders_mark: decoded.offenders_mark || [], 
//     seal: decoded.seal !== undefined ? decoded.seal : null,
//   };
// };