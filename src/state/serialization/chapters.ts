import { u32 } from 'scale-ts';
import { BlockItemCodec, concatAll, EntropyBufferCodec, ValidatorsInfoCodec } from '../../codecs';
import { AuthPoolCodec } from '../../codecs/AuthPools/AuthPoolCodec';
import { PrivilegesCodec } from '../../stf/accumulate/codecs/PrivilegesCodec';
import { ReadyQueueCodec } from '../../stf/accumulate/codecs/ReadyQueueCodec';
import { AuthQueueCodec } from '../../stf/authorizations/codecs/AuthQueues/AuthQueueCodec';
import { RecordsCodec } from '../../stf/disputes/codecs/RecordsCodec';
import { TimeSlotCodec } from '../../stf/safrole/types';
import { StatisticsCodec } from '../../stf/statistics/codecs/StatisticsCodec';
import { State } from '../types'; 
import { GammaCodec } from './codecs/GammaCodec';
import { PendingReportsCodec } from './codecs/PendingReportsCodec';
import { ServiceAccountHeaderCodec } from './codecs/service';
import { makeStateKey } from './key';
import { AccumulatedQueueCodec } from '../../stf/accumulate/codecs/AccumulatedQueueCodec';


// Ordered by chapter ID from (D.2) in D1
export enum ChapterID {
  AuthorizationsPool      = 1,   // α (Core authorizations pool) alpha 
  AuthorizationQueue      = 2,   // φ (Authorization queue) phi
  RecentBlocks            = 3,   // β (Recent blocks info) beta
  Gamma                   = 4,   // γ (Gamma Safrole state, including sealing tickets, validator keys) gamma
  Judgments               = 5,   // ψ (Past judgments on reports/validators) psi
  Entropy                 = 6,   // η (Entropy accumulator) eta
  ValidatorsNext          = 7,   // ι (Validator keys for next epoch) iota
  ValidatorsCurrent       = 8,   // κ (Currently active validator keys) kappa
  ValidatorsPrev          = 9,   // λ (Validator keys active in previous epoch) lambda
  PendingReports          = 10,  // ρ (Pending reports per core) rho
  Timeslot                = 11,  // τ (Most recent block's timeslot) tau
  PrivilegedServices      = 12,  // χ (Privileged service indices) chi
  ValidatorStats          = 13,  // π (Validator activity statistics) pi
  ReadyQueue              = 14,  // ϑ (Accumulation queue) theta
  AccumulationHistory     = 15,  // ξ (Accumulation history) chi

  ServiceAccountsOuter    = 255  // δ (Outer shell of service accounts) delta
}


/**
 * Serialize the entire state into an array of `[key,value]` pairs
 * ready to be Merklized.  Order strictly follows the protocol (D.2).
 */
export function serializeState(state: State): [Uint8Array, Uint8Array][] {
  const out: [Uint8Array, Uint8Array][] = [];

  // helper to push a key/value pair into the output array
  // and also hash the value to create the key for the next chapter
  const push = (chapter: ChapterID, bytes: Uint8Array, svc?: number) => {
    out.push([makeStateKey(chapter, svc), bytes]);
  };

  push(ChapterID.AuthorizationsPool,        AuthPoolCodec.enc(state.authorization));   // alpha α  Authorisations pool
  push(ChapterID.AuthorizationQueue,        AuthQueueCodec.enc(state.coreQueue));      // phi φ  Authorisation queue
  push(ChapterID.RecentBlocks,              BlockItemCodec.enc(state.recentBlocks));   // beta β  Recent blocks
  push(ChapterID.Gamma,                     GammaCodec.enc(state.gamma)); // gamma γ Gamma Codec
  push(ChapterID.Judgments,                 RecordsCodec.enc(state.judgements));   // psi ψ  Judgements
  push(ChapterID.Entropy,                   EntropyBufferCodec.enc(state.entropyPool));   // eta η  Entropy
  push(ChapterID.ValidatorsNext,            ValidatorsInfoCodec.enc(state.validatorQueue)); // iota ι  Validators-next
  push(ChapterID.ValidatorsCurrent,         ValidatorsInfoCodec.enc(state.currentValidators));   //kappa  κ  Validators-current
  push(ChapterID.ValidatorsPrev,            ValidatorsInfoCodec.enc(state.archivedValidators));   // lambda λ  Validators-previous
  push(ChapterID.PendingReports,            PendingReportsCodec.enc(state.pendingReports));  // rho ρ  Pending reports
  push(ChapterID.Timeslot,                  TimeSlotCodec.enc(state.timeslotIndex));   // tau τ  Timeslot
  push(ChapterID.PrivilegedServices,        PrivilegesCodec.enc(state.privilegedServices));   // chi χ  Privileged services
  push(ChapterID.ValidatorStats,            StatisticsCodec.enc(state.validatorStatistics));   // pi π  Validator statistics
  push(ChapterID.ReadyQueue,                ReadyQueueCodec.enc(state.workReports));   // theta ϑ  Ready queue
  push(ChapterID.AccumulationHistory,       AccumulatedQueueCodec.enc(state.workPackages));   // chi ξ  Accumulation history
  
  // 255
  for (const [svcIdStr, account] of Object.entries(state.services)) {
    const svc = Number(svcIdStr);

    // δ outer mini-record  (row: C(255,s)) */
    push(
      ChapterID.ServiceAccountsOuter,
      ServiceAccountHeaderCodec.enc(account.header),
      svc,
    );

    // delta - storage  inner mini records d_s
    for (const [key, value] of account.data.storage) {
      const keyBlob = concatAll(
        u32.enc(0xFFFF_FFFF),           // 2^32 − 1
        key.slice(0, 30)                // first 30 bytes of the 32 byte key
      );
      out.push([makeStateKey(svc, keyBlob), value]);
    }

    // delta – preimages
    for (const [hash, blob] of account.data.preimages) {
      const keyBlob = concatAll(
        u32.enc(0xFFFF_FFFE),           // 2^32 − 2
        hash.slice(1, 30)               // bytes 1…29 of the 32 byte hash
      );
      out.push([makeStateKey(svc, keyBlob), blob]);
    }

    // delta – lookup
    for (const [idx, root] of account.data.lookup) {
      const keyBlob = concatAll(
        u32.enc(idx),
        root.slice(2, 31)           // bytes 2…30 of H(root)
      );
      out.push([makeStateKey(svc, keyBlob), root]);
    }
  }

  return out;
}