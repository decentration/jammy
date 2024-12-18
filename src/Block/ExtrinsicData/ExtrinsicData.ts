import { Ticket, Dispute, Preimage, Availability, Report } from './types';
import { Vector, Struct } from 'scale-ts';
import { TicketCodec, DisputeCodec, PreimageCodec, AvailabilityCodec, ReportCodec } from './types';

export interface ExtrinsicData {
    tickets: Ticket[];
    preimages: Preimage[];
    reports: Report[];
    availability: Availability[];
    disputes: Dispute[];
}

export const ExtrinsicDataCodec = Struct({
    tickets: Vector(TicketCodec),
    preimages: Vector(PreimageCodec),
    reports: Vector(ReportCodec),
    availability: Vector(AvailabilityCodec),
    disputes: Vector(DisputeCodec),
});

export function serializeExtrinsicData(data: ExtrinsicData): Uint8Array {
    return ExtrinsicDataCodec.enc(data);
}

export function deserializeExtrinsicData(data: Uint8Array): ExtrinsicData {
    return ExtrinsicDataCodec.dec(data);
}