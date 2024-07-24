import { BlockHeader } from './header';
import { ExtrinsicData } from './extrinsicData';

export interface Block {
    header: BlockHeader;
    extrinsic: ExtrinsicData;
}

// TODO? serialize block and deserialize block if needed 