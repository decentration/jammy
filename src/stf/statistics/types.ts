import { Struct, u32 } from "scale-ts";
import { Assurance, Dispute, Guarantee, Preimage, ServicesStatisticsMapEntry, Ticket } from "../../types/types";
import { ValidatorInfo } from "../types";
import { CoresActivityRecord } from "../reports/types";


export interface StatsStf {
    input: StatsInput;
    pre_state: StatsState;
    output: StatsOutput;
    post_state: StatsState;
  }

  export interface ExtrinsicData {
    tickets: Ticket[];
    preimages: Preimage[];
    guarantees: Guarantee[];
    assurances: Assurance[];
    disputes: Dispute;
  }
  
 
  export interface StatsInput {
    slot: number;          // TimeSlot = u32
    author_index: number;  // ValidatorIndex = u32
    extrinsic: ExtrinsicData;
  }
  

  export type StatsOutput = null;
  

  export interface StatsState {
    statistics: Statistics;
    slot: number;               // TimeSlot = u32
    curr_validators: ValidatorInfo[];
  }
  
  export interface Statistics {
    vals_current: PerformanceRecord[];
    vals_last: PerformanceRecord[];
    cores: CoresActivityRecord[];
    services: ServicesStatisticsMapEntry[];
  }
  
  export interface PerformanceRecord {
    blocks: number; // 4 bytes
    tickets: number;
    pre_images: number;
    pre_images_size: number;
    guarantees: number;
    assurances: number;
  }


export const PerformanceRecordCodec = Struct({
    blocks: u32, // 4 bytes
    tickets: u32, // 4 bytes
    pre_images: u32, // 4 bytes
    pre_images_size: u32,
    guarantees: u32,
    assurances: u32,
  });
  
  
  export interface StatsExtrinsic {
    tickets: {
      attempt: number;
      signature: string;
    }[];
    preimages: {
      requester: number;
      blob: string;
    }[];
    guarantees: {
      report: any;
      slot: number;
      signatures: {
        validator_index: number;
        signature: string;
      }[];
    }[];
    assurances: {
      anchor: string;
      bitfield: string;
      validator_index: number;
      signature: string;
    }[];
    disputes: {
      verdicts: any[];
      culprits: any[];
      faults: any[];
    };
  }
  