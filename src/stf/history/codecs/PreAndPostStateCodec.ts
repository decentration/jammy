import { Codec } from 'scale-ts';
import { BetaItem } from '../../types'; // Adjust the path for BetaItem type
import { BetaItemCodec } from '../../../codecs/BetaItemCodec'; // Adjust the path for BetaItemCodec
import { DiscriminatorCodec, decodeWithBytesUsed } from '../../../codecs';

/**
 * PreAndPostState represents structures like:
 * { beta: BetaItem[] }
 */
export const PreAndPostStateCodec: Codec<{ beta: BetaItem[] }> = [
  // ENCODER
  (state: { beta: BetaItem[] }): Uint8Array => {
    const encBeta = DiscriminatorCodec(BetaItemCodec).enc(state.beta);

    return encBeta;
  },

  // DECODER
  (data: ArrayBuffer | Uint8Array | string): { beta: BetaItem[] } => {
    const uint8 =
      data instanceof Uint8Array
        ? data
        : typeof data === 'string'
        ? new TextEncoder().encode(data)
        : new Uint8Array(data);

    const { value: beta, bytesUsed } = decodeWithBytesUsed(
      DiscriminatorCodec(BetaItemCodec),
      uint8
    );

    return { beta };
  },
] as unknown as Codec<{ beta: BetaItem[] }>;

PreAndPostStateCodec.enc = PreAndPostStateCodec[0];
PreAndPostStateCodec.dec = PreAndPostStateCodec[1];
