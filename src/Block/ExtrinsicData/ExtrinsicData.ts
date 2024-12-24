import { Vector, Struct } from 'scale-ts';
import { Ticket, Dispute, Preimage, Guarantee, Assurance } from '../types';
import { TicketCodec, DisputeCodec, PreimageCodec, GuaranteeCodec, AssuranceCodec } from '../types';
import { SequenceCodec } from '../../encodingUtils/SequenceCodec';

const AssuranceSequenceCodec = SequenceCodec(AssuranceCodec);
export interface ExtrinsicData {
  tickets: Ticket[];
  preimages: Preimage[];
  guarantees: Guarantee[];
  assurances: Assurance[];
  disputes: Dispute;
}

export const ExtrinsicDataCodec = Struct({
  tickets:    SequenceCodec(TicketCodec),
  preimages:  SequenceCodec(PreimageCodec),
  guarantees: SequenceCodec(GuaranteeCodec),
  assurances: SequenceCodec(AssuranceCodec),
  disputes: DisputeCodec,
});

export function serializeExtrinsicData(data: ExtrinsicData): Uint8Array {
  return ExtrinsicDataCodec.enc(data);
}

export function deserializeExtrinsicData(data: Uint8Array): ExtrinsicData {
  return ExtrinsicDataCodec.dec(data);
}
