// import { Header, HeaderCodec, serializeHeaderWithoutSeal } from './Header';
// import { ExtrinsicDataCodec, ExtrinsicData } from './ExtrinsicData/ExtrinsicData';
// import { Struct } from 'scale-ts';
// import { sha256 } from '@noble/hashes/sha256';
 
// export interface Block {
//     header: Header;
//     extrinsic: ExtrinsicData;
// }

// export const BlockCodec = Struct({
//     header: HeaderCodec,
//     extrinsic: ExtrinsicDataCodec,
// });


// export function serializeBlock(block: Block, parentBlock: Block): Uint8Array {
//     // Step 1: Serialize parent header without seal
//     const serializedParentHeader = serializeHeaderWithoutSeal(parentBlock.header);
//     // Step 2: Compute the parent hash (Hp) for the current block
//     const hp = sha256(serializedParentHeader);
  
//     // Step 3: Compute the extrinsic hash (Hx) for the current block
//     const serializedExtrinsic = ExtrinsicDataCodec.enc(block.extrinsic);
//     const hx = sha256(serializedExtrinsic);
  
//     // Step 4: Build the current block's header with updated Hx and Hp values
//     const headerWithHashes: Header = {
//       ...block.header,
//       extrinsic_hash: hx,
//       parent: hp,
//       epoch_mark: block.header.epoch_mark !== null ? block.header.epoch_mark : null,
//       tickets_mark: block.header.tickets_mark !== null ? block.header.tickets_mark : null,
//       seal: block.header.seal !== null ? block.header.seal : null
//     };
  
//     // Step 5: Serialize the block with the updated header
//     const blockWithUpdatedHeader: Block = {
//       header: headerWithHashes,
//       extrinsic: block.extrinsic,
//     };
  
//     return BlockCodec.enc({
//         ...blockWithUpdatedHeader,
//         header: {
//             ...blockWithUpdatedHeader.header,
//             epoch_mark: blockWithUpdatedHeader.header.epoch_mark !== null ? blockWithUpdatedHeader.header.epoch_mark : undefined,
//             tickets_mark: blockWithUpdatedHeader.header.tickets_mark !== null ? blockWithUpdatedHeader.header.tickets_mark : undefined,
//             seal: blockWithUpdatedHeader.header.seal !== null ? blockWithUpdatedHeader.header.seal : undefined,

//         },
//     });
//   }


//   export function deserializeBlock(data: Uint8Array): Block {
//     console.log('Starting deserialization');
//     const decoded = BlockCodec.dec(data);
//     console.log('Decoded data:', decoded);

//     return {
//       header: {
//         ...decoded.header,
//         epoch_mark: decoded.header.epoch_mark !== undefined ? decoded.header.epoch_mark : null,
//         tickets_mark: decoded.header.tickets_mark !== undefined ? decoded.header.tickets_mark : null,
//         seal: decoded.header.seal !== undefined ? decoded.header.seal : null,
//       },
//       extrinsic: decoded.extrinsic,
//     };
//   }
  