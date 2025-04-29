import { accumulateSingleService, mergeEphemeralChanges } from "../helpers";
import { AccumulateEphemeral, AccumulateState, ReadyRecord } from "../types";


/**
  * accumulateAcceptedReports:
  *  - 12.17 but done sequentially (no real parallel).
  *  - TODO: parallel processing
  *  - For each report => process all items grouped by service => (12.19).
*/
export async function accumulateAcceptedReports(
   state: AccumulateState,
   acceptedReports: ReadyRecord[],
   blockGasLimit: number,
   slot: number
 ): Promise<{
   updatedPostState: AccumulateState,
   accumulatedOutputs: any[],
   newlyAccumulatedHashes: Uint8Array[] 
 }> {
   const outputs = [];
   const done: Uint8Array[]    = [];
   
   for (const record of acceptedReports) {
     const rep = record.report;
     const repHash  = rep.package_spec.hash;
 
     // group results by service
     const serviceMap = new Map<number, any[]>();
     for (const res of rep.results) {
       const sid = res.service_id;
       if (!serviceMap.has(sid)) {
         serviceMap.set(sid, []);
       }
       serviceMap.get(sid)!.push(res);
     }
 
     // For each service => do a single service accumulate
     const ephemeralForThisReport = [];
     for (const [serviceId, serviceResults] of serviceMap.entries()) {
       
      // (12.19)
       const ephemeral = await accumulateSingleService(
         state, 
         slot, 
         serviceId, 
         serviceResults, 
         blockGasLimit
       );
       mergeEphemeralChanges(state, ephemeral); 
       ephemeralForThisReport.push({ service_id: serviceId, ephemeral });
     }
 
     if (!state.accumulated[state.accumulated.length - 1]) {
       state.accumulated.push([]);
     }
     state.accumulated[state.accumulated.length - 1].push(repHash);
     done.push(repHash);

     outputs.push({ 
       reportHash: repHash,
       ephemeralForThisReport
     });
   }
 
   return {
     updatedPostState: state,
     accumulatedOutputs: outputs,
     newlyAccumulatedHashes: done
   };
 }
 

function mergeEphemeralChanges(
  state: AccumulateState,
  ephemeral: AccumulateEphemeral
) {
  // new services
  if (ephemeral.newServices) {
    for (const ns of ephemeral.newServices) {
      if (state.accounts.some(a => a.id === ns.serviceId)) {
        throw new Error("Collision: serviceId already exists");
      }
      state.accounts.push({
        id: ns.serviceId,
        data: {
          service: {
            code_hash: ns.codeHash,
            balance: 0,
            min_item_gas: 0,
            min_memo_gas: 0,
            bytes: 0,
            items: 0
          },
          preimages: []
        }
      });
    }
  }

  // code upgrades
  if (ephemeral.codeUpgrades) {
    for (const cu of ephemeral.codeUpgrades) {
      const svc = state.accounts.find(a => a.id === cu.serviceId);
      if (svc) {
        svc.data.service.code_hash = cu.newCodeHash;
      }
    }
  }

  // self terminated
  if (ephemeral.selfTerminated) {
  //  
  }
}
