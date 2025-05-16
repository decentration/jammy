import { AccumulatedQueue, Privileges, ReadyQueue } from '../stf/accumulate/types';
import { DisputesRecords } from '../stf/disputes/types';
import { Entropy } from '../stf/reports/types';
import { Statistics } from '../stf/statistics/types';
import { BlockItem, History, ValidatorInfo } from '../stf/types';
import { AuthorizerHash } from '../types';
import { Gamma } from './serialization/codecs/GammaCodec';
import { PendingReports } from './serialization/codecs/PendingReportsCodec';
import { ServiceAccount } from './serialization/codecs/service';

export interface State {
  authorization: AuthorizerHash[];                // α
  coreQueue: AuthorizerHash[];               // φ
  recentBlocks: BlockItem;                  // β
  gamma: Gamma;                                // γ 
  judgements: DisputesRecords;                      // ψ
  entropyPool: Entropy[];                    // η
  validatorQueue: ValidatorInfo[];              // ι
  currentValidators: ValidatorInfo[];        // κ
  archivedValidators: ValidatorInfo[];      // λ
  pendingReports: PendingReports;                    // ρ
  timeslotIndex: number;                // τ
  privilegedServices: Privileges;      // χ
  validatorStatistics: Statistics;    // π
  workReports: ReadyQueue;                    // ϑ
  workPackages: AccumulatedQueue;                  // ξ
  services: ServiceAccount;                          // δ (outer service accounts)
}

