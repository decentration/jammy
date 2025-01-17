import { ValidatorInfo } from '../stf/types';

// State as per 4.2 in the gray paper

export interface State {
    authorization: Authorization;  // α (alpha)
    recentBlocks: RecentBlocks;    // β (beta)
    gamma: Gamma;  // γ  (gamma)
    services: Services;            // δ (delta)
    entropyPool: EntropyPool;      // η (eta)
    validatorQueue: ValidatorQueue; // ι  (iota)
    currentValidators: CurrentValidators; // κ (kappa)
    archivedValidators: ArchivedValidators; // λ (lambda)
    coreReports: CoreReports;      // ρ (rho)
    timeslotIndex: TimeslotIndex;  // τ (tau)
    coreQueue: CoreQueue;          // φ (phi)
    privilegedServices: PrivilegedServices; // χ   (chi)
    judgements: Judgements;        // ψ (psi)
    validatorStatistics: ValidatorStatistics; //  π (pi)
    workReports: WorkReports;      // ϑ (theta)
    workPackages: WorkPackages;    // ξ (xi)
  }
  
  export interface Authorization {
    required: string[];
  }
  
  export interface RecentBlocks {
    blockHashes: string[];
  }
  
  export interface Gamma {
    /**
     * gamma_k: the pending set of keys => will become active next epoch
     */
    gamma_k: ValidatorInfo[]; // ValidatorInfo 
  
    /**
     * gamma_z: the ring root composed of next epoch’s Bandersnatch keys.
     * 32-byte root...
     */
    gamma_z: Uint8Array;  
  
    /**
     * gamma_s: the slot-sealer series for the current epoch, each entry is either
     *   - a "ticket" { y, r } (the VRF output y and entry-index r), or
     *   - a fallback Bandersnatch key for emergency.
     */
    gamma_s: Uint8Array[];  
  
    /**
     * gamma_a: the ticket accumulator — “series of highest-scoring ticket IDs”.
     * We'll store them as 32-byte IDs. 
     */
    gamma_a: Uint8Array[];  
  }
  


  export interface Services {
    accounts: string[];
  }
  
  export interface EntropyPool {
    pool: string;
  }
  
  export interface ValidatorQueue {
    queue: string[];
  }
  
  export interface CurrentValidators {
    validators: string[];
  }
  
  export interface ArchivedValidators {
    archive: string[];
  }
  
  export interface CoreReports {
    reports: string[];
  }
  
  export interface TimeslotIndex {
    index: number;
  }
  
  export interface CoreQueue {
    queue: string[];
  }
  
  export interface PrivilegedServices {
    services: string[];
  }
  
  export interface Judgements {
    judgements: string[];
  }
  
  export interface ValidatorStatistics {
    statistics: string[];
  }
  
  export interface WorkReports {
    reports: string[];
  }
  
  export interface WorkPackages {
    packages: string[];
  }