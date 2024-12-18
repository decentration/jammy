import { Header, HeaderCodec, serializeHeader } from './Header';
import { ExtrinsicData, ExtrinsicDataCodec, serializeExtrinsicData } from './ExtrinsicData/ExtrinsicData';
import { Struct } from 'scale-ts';
import { sha256 } from '@noble/hashes/sha2';

export interface Block {
    header: Header;
    extrinsic: ExtrinsicData;
}

export const BlockCodec = Struct({
    header: HeaderCodec,
    extrinsic: ExtrinsicDataCodec,
});

export function serializeBlock(block: Block): Uint8Array {
    // serialize extrinsic data and compute Hx
    const serializedExtrinsic = ExtrinsicDataCodec.enc(block.extrinsic);
    const hx = sha256(serializedExtrinsic);

    // Compute Hp
    const parentHeaderWithoutSeal = { ...block.header, blockSeal: new Uint8Array(0) };
    const serializedParentHeader = HeaderCodec.enc(parentHeaderWithoutSeal);
    const hp = sha256(serializedParentHeader);

    // Build the header with updated Hx (extrinsic header ) and Hp (parent hash)
    const headerWithHashes = { ...block.header, extrinsicHash: hx, parentHash: hp };

    // Serialize the block
    const blockWithUpdatedHeader: Block = {
        header: headerWithHashes,
        extrinsic: block.extrinsic,
    };
    return BlockCodec.enc(blockWithUpdatedHeader);
}

export function deserializeBlock(data: Uint8Array): Block {
    return BlockCodec.dec(data);
}
