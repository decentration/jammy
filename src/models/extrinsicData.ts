import { Ticket, Judgement, Preimage, Availability, Report } from './ExtrinsicData/index';

export interface ExtrinsicData {
    tickets: Ticket[];
    judgements: Judgement[];
    preimages: Preimage[];
    availability: Availability[];
    reports: Report[];
}

function serializeExtrinsicData(data: ExtrinsicData): string {
    // TODO: implement serialization of extrinsic data
  }
  
  function deserializeExtrinsicData(data: string): ExtrinsicData {
    // TODO: implement deserialization of extrinsic data
  }