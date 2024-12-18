import { Struct, u8, Bytes } from 'scale-ts';

export interface Ticket {
  validatorId: Uint8Array;
  ticketId: Uint8Array;   
}

export const TicketCodec = Struct({
  validatorId: Bytes(32),
  ticketId: Bytes(32),
});

export interface Dispute {
  validatorId: Uint8Array;
  disputeId: Uint8Array;
}

export const DisputeCodec = Struct({
  validatorId: Bytes(32),
  disputeId: Bytes(32),
});

export interface Preimage {
  dataHash: Uint8Array; 
}

export const PreimageCodec = Struct({
  dataHash: Bytes(32),
});

export interface Availability {
  validatorId: Uint8Array; 
  isDataAvailable: number;
}

export const AvailabilityCodec = Struct({
  validatorId: Bytes(32),
  isDataAvailable: u8, 
});

export interface Report {
  workloadId: Uint8Array;   
  validatorId: Uint8Array;  
}

export const ReportCodec = Struct({
  workloadId: Bytes(32),
  validatorId: Bytes(32),
});