import { Block, serializeBlock, deserializeBlock } from '../models/block';
import { BlockHeader } from '../models/header';
import { ExtrinsicData } from '../models/extrinsicData';

describe('Block serialization and deserialization', () => {
    it('should serialize and deserialize the block correctly', () => {
        const header: BlockHeader = {
            parentHash: '0xabc',
            priorStateRoot: '0xdef',
            extrinsicHash: '0x123',
            timeSlotIndex: 11111111,
            epochMarker: 1,
            winningTicketsMarkers: '0xwinning',
            judgementsMarkers: ['0x0xjudge1', '0xjudge2'],
            authorKey: '0xauthor',
            vrfSignature: '0xvrfsig',
            blockSeal: '0xblockseal'
        };

        const extrinsicData: ExtrinsicData = {
            tickets: [],
            judgements: [],
            preimages: [],
            availability: [],
            reports: []
        };

        const block: Block = { header, extrinsic: extrinsicData };

        const serializedBlock = serializeBlock(block);
        const deserializedBlock = deserializeBlock(serializedBlock);

        expect(deserializedBlock).toEqual(block);
    });
});