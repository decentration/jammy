import { toUint8Array } from "../codecs";
import { blake2b } from "blakejs";
import { EPOCH_LENGTH } from "../consts";
import { SafroleState } from "./types";
import { ValidatorInfo } from "../stf/types";
import { BandersnatchPublic, BandersnatchRingRoot, OffendersMark } from "../types/types";

export function blake2bConcat(x: Uint8Array | string, y: Uint8Array | string, bytesOutput: number = 32): Uint8Array {

  // clean inputs
  if (typeof x === "string") x = toUint8Array(x);
  if (typeof y === "string") y = toUint8Array(y);

  // console.log("x", x);
  // console.log("y", y);
  
  const combined = new Uint8Array(x.length + y.length);
  combined.set(x, 0);
  combined.set(y, x.length);
  // console.log("combined", combined);

  return blake2b(combined, undefined, bytesOutput);
}

// epoch index = floor(slot/EPOCH_LENGTH)
export function getEpoch(slot: number): number {
  return Math.floor(slot / EPOCH_LENGTH);
}

/** (6.23): rotate the entropies if:
 * e' > e => (eta'[1], eta'[2], eta'[3]) = (eta[0], eta[1], eta[2]) 
 */
export function epochEntropyRotate(state: SafroleState) {
  const [ e0, e1, e2 ] = state.eta;
  state.eta[1] = e0;
  state.eta[2] = e1;
  state.eta[3] = e2;
}

 
// (6.13)
export function epochBoundaryRotateOnce(state: SafroleState) {
    const oldGammaK = state.gamma_k;
    const oldKappa  = state.kappa;
    const oldIota   = state.iota;
  
    state.gamma_k = structuredClone(oldIota);
    state.kappa   = structuredClone(oldGammaK);
    state.lambda  = structuredClone(oldKappa);
  
  }

   /** 
  * If no offenders, returns the same array. Otherwise, 
  * returns a new array with the “offender” keys set to zero. 
  */
export function zeroOutOffenders(
   iotaArray: ValidatorInfo[], 
   offenders: OffendersMark[]
 ): ValidatorInfo[] {
   
   if (!offenders.length) {
    console.log("no offenders");
     return structuredClone(iotaArray); 
   }
   
   // Build a set for faster membership checks
   const offenderSet = new Set(offenders.map(off => off));
 
   return iotaArray.map((val) => {
     // If val.bandersnatch is in the offender set => zero out
     if (offenderSet.has(val.bandersnatch)) {
       const zeroKey: ValidatorInfo = {
         bandersnatch: new Uint8Array(32), // all zero  
         ed25519:      new Uint8Array(32), // all zero        
         bls:        new Uint8Array(144), // all zero
         metadata:     new Uint8Array(128),
       };
       return zeroKey;
     } else {
       return structuredClone(val);
     }
   });
 }

