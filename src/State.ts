// State as per 4.2 in the gray paper

export interface State {
    authorization: Authorization;  // α (alpha)
    recentBlocks: RecentBlocks;    // β (beta)
    validatorKeys: ValidatorKeys;  // γ  (gamma)
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
  
  export interface ValidatorKeys {
    keys: string[];
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