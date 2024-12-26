import { Vector, Struct } from 'scale-ts';
import { Ticket, Dispute, Preimage, Guarantee, Assurance } from '../types';
import { TicketCodec, DisputeCodec, PreimageCodec, GuaranteeCodec, AssuranceCodec } from '../types';
import { DiscriminatorCodec } from '../../codecs/DiscriminatorCodec';

const AssuranceDiscriminatorCodec = DiscriminatorCodec(AssuranceCodec);
export interface ExtrinsicData {
  tickets: Ticket[];
  preimages: Preimage[];
  guarantees: Guarantee[];
  assurances: Assurance[];
  disputes: Dispute;
}

export const ExtrinsicDataCodec = Struct({
  tickets:    DiscriminatorCodec(TicketCodec),
  preimages:  DiscriminatorCodec(PreimageCodec),
  guarantees: DiscriminatorCodec(GuaranteeCodec),
  assurances: DiscriminatorCodec(AssuranceCodec),
  disputes: DisputeCodec,
});

export function serializeExtrinsicData(data: ExtrinsicData): Uint8Array {
  return ExtrinsicDataCodec.enc(data);
}

export function deserializeExtrinsicData(data: Uint8Array): ExtrinsicData {
  return ExtrinsicDataCodec.dec(data);
}
