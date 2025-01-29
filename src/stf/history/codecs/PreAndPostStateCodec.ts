import { Codec } from 'scale-ts';
import { BlockItem } from '../../types'; 
import { BlockItemCodec } from '../../../codecs/BlockItemCodec';
import { DiscriminatorCodec, decodeWithBytesUsed } from '../../../codecs';

/**
 * PreAndPostState represents structures like:
 * { beta: BlockItem[] }
 */
export const PreAndPostStateCodec: Codec<{ beta: BlockItem[] }> = [
  // ENCODER
  (state: { beta: BlockItem[] }): Uint8Array => {
    const encBeta = DiscriminatorCodec(BlockItemCodec).enc(state.beta);

    return encBeta;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): { beta: BlockItem[] } => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    const { value: beta, bytesUsed } = decodeWithBytesUsed(
      DiscriminatorCodec(BlockItemCodec),
      uint8
    );

    return { beta };
  },
] as unknown as Codec<{ beta: BlockItem[] }>;

PreAndPostStateCodec.enc = PreAndPostStateCodec[0];
PreAndPostStateCodec.dec = PreAndPostStateCodec[1];
