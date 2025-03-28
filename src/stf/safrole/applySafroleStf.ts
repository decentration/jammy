import { SafroleState, SafroleInput, SafroleOutput, ErrorCode, EpochMark, TicketVerifyContext } from "./types";
import { TicketsMark } from "../../types/types";
import { convertToReadableFormat, toHex } from "../../utils";
import { blake2bConcat, outsideIn, zeroOutOffenders } from "./helpers";
import { CONTEST_DURATION, EPOCH_LENGTH, TICKETS_PER_VALIDATOR } from "../../consts";
import { rebuildGammaSForEpochChange } from "./gamma";
import { aggregator } from "../../ring-vrf-ffi/ring_vrf_ffi"
import { verifyTicketSignature } from "./verifyTicketSignature";


export function applySafroleStf(
  preState: SafroleState,
  input: SafroleInput
): { output: SafroleOutput; postState: SafroleState } {
  // 0) clone state
  const postState: SafroleState = structuredClone(preState);

  // 1) check slot progression
  if (input.slot <= preState.tau) {
    return { 
      output: { err: ErrorCode.BAD_SLOT }, 
      postState: preState 
    };
  }

  // 2) tau
  postState.tau = input.slot;

  if (postState.tau >= CONTEST_DURATION && input.extrinsic?.length > 0) {
      return { output: { err: ErrorCode.UNEXPECTED_TICKET }, postState: preState };
  }

  // 3) Update primary entropy accumulator
  // (6.22) -  Save pre‐rotation entropy values for later use in the rotation.
  const preEta0 = preState.eta[0];
  postState.eta[0] = blake2bConcat(preEta0, input.entropy);

  
  // (4) Calculate old/new epochs
  const oldEpoch = Math.floor(preState.tau / EPOCH_LENGTH);
  const newEpoch = Math.floor(input.slot / EPOCH_LENGTH);
  let epochDiff  = newEpoch - oldEpoch;

  let epochMark: EpochMark | null = null;

  if (epochDiff > 0) {
    // capture the old epoch’s original entropies, because we 
    // seemingly don't need to make ephemoral shifts for skipped epochs...
    const originalOldEta0 = preState.eta[0];
    const originalOldEta1 = preState.eta[1];
   
    handleSingleEpochChange(
      preState,
      postState,
      oldEpoch,       // old epoch
      newEpoch       // new epoch
    );
  

  // final new epoch mark
  epochMark = {
    entropy:         originalOldEta0,
    tickets_entropy: originalOldEta1,
    validators:      postState.gamma_k.map(v => ({ bandersnatch: v.bandersnatch, ed25519: v.ed25519 })),
  };

} else {
  // => no epoch boundary 
  postState.gamma_k = preState.gamma_k;
  postState.kappa   = preState.kappa;
  postState.lambda  = preState.lambda;
  postState.gamma_z = preState.gamma_z;
}

// 5) Handle extrinsic

  // i) Gather and verify new tickets
  const newTickets: { id: Uint8Array; attempt: number }[] = [];

  if (input.extrinsic && input.extrinsic.length > 0) {

   for (const ticketEnv of input.extrinsic) {
 
    // console.log("ticketEnv", ticketEnv);
     if (ticketEnv.attempt >= TICKETS_PER_VALIDATOR) {
      //  console.log("ticketEnv.attempt too high", ticketEnv.attempt);
       return { output: { err: ErrorCode.BAD_TICKET_ATTEMPT }, postState: preState };
     }
 
     // ring VRF verify ...
     const ringKeysStr = preState.gamma_k
       .map(v => Buffer.from(v.bandersnatch).toString("hex"))
       .join(" ");
 
     const verifyResult = verifyTicketSignature({
       ringKeysStr,
       entropy2: Buffer.from(preState.eta[2]).toString("hex"),
       attempt: ticketEnv.attempt,
     }, ticketEnv.signature);
 
     if (!verifyResult.ok) {
       return { output: { err: ErrorCode.BAD_TICKET_PROOF }, postState: preState };
     }
 
     newTickets.push({
       id: verifyResult.vrfOutput,
       attempt: ticketEnv.attempt,
     });
   }
 
   console.log("newTickets", convertToReadableFormat(newTickets));
 
   // ii) Check new tickets among themselves for ascending ID
   for (let i = 1; i < newTickets.length; i++) {
       const prev = newTickets[i - 1].id;
       const curr = newTickets[i].id;
       if (!isLexicographicallyAscending(prev, curr)) {
       return { output: { err: ErrorCode.BAD_TICKET_ORDER }, postState: preState };
       }
   }
  }
   // iii) Merge old + new => single array
   const merged = [...postState.gamma_a, ...newTickets];
 
 
   // iv) Sort merged by ID
   merged.sort((a, b) => compareTicketID(a.id, b.id));
 
   console.log("merged", convertToReadableFormat(merged));
 
 
   for (let i = 1; i < merged.length; i++) {
       const prev = merged[i - 1];
       const curr = merged[i];
   
       // If same ID
       if (compareTicketID(prev.id, curr.id) === 0) {
         // If same attempt => DUPLICATE
         if (prev.attempt === curr.attempt) {
           return { output: { err: ErrorCode.DUPLICATE_TICKET }, postState: preState };
         }
         // If new attempt <= old => BAD_TICKET_ATTEMPT and if
         if (curr.attempt <= prev.attempt) {
          
           return { output: { err: ErrorCode.BAD_TICKET_ATTEMPT }, postState: preState };
         }
       }
     }

     while (merged.length > EPOCH_LENGTH) {
      merged.pop(); 
    }
   
 
   // Step 6) Store final
   postState.gamma_a = merged;
 
  //  console.log("final gamma_a", convertToReadableFormat(postState.gamma_a));    

  // 7) If publish with mark, add tickets to output
  let tickets_mark: TicketsMark[] | null = null;
  let isPublishWithMark = false;


  if (postState.tau > CONTEST_DURATION && !newEpoch) {
    console.log("postState.tau > CONTEST_DURATION");
    isPublishWithMark = true;

    // shallow copy....
    const finalTickets = postState.gamma_a.map(m => ({ ...m })); 
    // finalTickets is sorted ascending from steps above
    let outsideInArr = outsideIn(finalTickets); 

    if (outsideInArr.length === 0) {
      tickets_mark = null;
    } else {
      tickets_mark = outsideInArr.map((m) => ({
        id: m.id,
        attempt: m.attempt,
      }));
    }

  }

  if (isPublishWithMark && isTicketsType(postState.gamma_s)) {
    tickets_mark = postState.gamma_s.tickets;
  }

    // 7) Output
    const output: SafroleOutput = {
      ok: {
        epoch_mark: epochMark,
        tickets_mark,
      },
    };


  // console.log("output", convertToReadableFormat(output));

  // console.log("postState", convertToReadableFormat(postState));

  // 8) return;
  return { output, postState };
}


function handleSingleEpochChange(
  preState: SafroleState,
  postState: SafroleState,
  oldEpoch: number,
  newEpoch: number
) {
  // 6.23 
  postState.eta[1] = preState.eta[0];
  postState.eta[2] = preState.eta[1];
  postState.eta[3] = preState.eta[2];

  // 6.13 
  postState.lambda = preState.kappa;
  postState.kappa  = preState.gamma_k;
  postState.gamma_k = zeroOutOffenders(preState.iota, preState.post_offenders);

  // reset gamma_a
  postState.gamma_a = [];

  // 6.24
  rebuildGammaSForEpochChange(preState, postState, oldEpoch, newEpoch);


  // aggregator TODO move to a separate function called getAggregatorBytes()
  const aggregatorSecret = preState.eta[2];
  console.log("aggregatorSecret", aggregatorSecret);

  const ringKeysStr = postState.gamma_k
    .map((validator) => Buffer.from(validator.bandersnatch).toString("hex"))
    .join(" ");

    console.log("ringKeysStr", ringKeysStr);

  const ringSize = postState.gamma_k.length;
  const srsPath = "./ring-vrf/data/zcash-srs-2-11-uncompressed.bin";

  const aggregatorBytes = aggregator(ringKeysStr, ringSize, srsPath);
  postState.gamma_z = aggregatorBytes;

}

function isTicketsType(gamma_s: SafroleState["gamma_s"]): gamma_s is { tickets: TicketsMark[] } {
  return "tickets" in gamma_s;
}

function compareTicketID(a: Uint8Array, b: Uint8Array): number {

  for (let i = 0; i < 32; i++) {
    if (a[i] !== b[i]) 
      return a[i] - b[i];
  }
  return 0;
}


function isLexicographicallyAscending(prev: Uint8Array, curr: Uint8Array): boolean {
  return compareTicketID(prev, curr) < 0;
}


