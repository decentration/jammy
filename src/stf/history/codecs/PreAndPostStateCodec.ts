import { Codec } from 'scale-ts';
import { BlockItem, HistoryState, RecentBlocks } from '../../types'; 
import { BlockItemCodec, DiscriminatorCodec, decodeWithBytesUsed } from '../../../codecs';
import { RecentBlocksCodec } from './RecentBlocksCodec';


export type Beta = { beta: BlockItem[] };

export const PreAndPostStateCodec: Codec<HistoryState> = [
  // ENCODER
  (state: HistoryState): Uint8Array => {
    const encBeta = RecentBlocksCodec.enc(state.beta);

    return encBeta;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): HistoryState => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    const { value: beta, bytesUsed } = decodeWithBytesUsed(
      RecentBlocksCodec,
      uint8
    );

    return { beta };
  },
] as unknown as Codec<HistoryState>;

PreAndPostStateCodec.enc = PreAndPostStateCodec[0];
PreAndPostStateCodec.dec = PreAndPostStateCodec[1];


