import { Vector, Struct } from 'scale-ts';
import { Ticket, Disputes, Preimage, Guarantee, Assurance } from '../types';
import { TicketCodec, DisputesCodec, PreimageCodec, GuaranteeCodec, AssuranceCodec } from '../types';
import { SequenceCodec } from '../../encodingUtils/SequenceCodec';

const AssuranceSequenceCodec = SequenceCodec(AssuranceCodec);
export interface ExtrinsicData {
  tickets: Ticket[];
  preimages: Preimage[];
  guarantees: Guarantee[];
  assurances: Assurance[];
  disputes: Disputes;
}

export const ExtrinsicDataCodec = Struct({
  tickets: Vector(TicketCodec),
  preimages: Vector(PreimageCodec),
  guarantees: Vector(GuaranteeCodec),
  assurances: AssuranceSequenceCodec,
  disputes: DisputesCodec,
});

export function serializeExtrinsicData(data: ExtrinsicData): Uint8Array {
  return ExtrinsicDataCodec.enc(data);
}

export function deserializeExtrinsicData(data: Uint8Array): ExtrinsicData {
  return ExtrinsicDataCodec.dec(data);
}
