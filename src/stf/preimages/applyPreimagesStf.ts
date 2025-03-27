
import { blake2b } from "blakejs";
import { PreimagesInput, PreimagesOutput, PreimagesState, ErrorCode, PreimagesMapEntry, AccountsMapEntry } from "./types";
import { compareBytes, toHex } from "../../utils";

export function applyPreimagesStf(
    preState: PreimagesState,
    input: PreimagesInput
  ): { output: PreimagesOutput; postState: PreimagesState } {
    
    // 1) Clone pre_state
    const postState: PreimagesState = structuredClone(preState);
  
    // 2) Check sorted + unique
    // use for loop to get access to prior element
    for (let i = 1; i < input.preimages.length; i++) {
    
      const prevRequester = input.preimages[i - 1].requester;
      const currRequester = input.preimages[i].requester;
      const prevBlob = input.preimages[i - 1].blob; 
      const currBlob = input.preimages[i].blob; 

      if (prevRequester < currRequester) {
        continue;
        } else if (prevRequester > currRequester) {
          console.log("prevRequester and currRequester", prevRequester, currRequester);
          return { output: { err: ErrorCode.PREIMAGES_NOT_SORTED_UNIQUE }, postState: preState };
        } else if (prevRequester == currRequester) {
          if (!isLexicographicallyAscending(prevBlob, currBlob)) {
          console.log("prevRequester and currRequester", prevRequester, currRequester);
          return { output: { err: ErrorCode.PREIMAGES_NOT_SORTED_UNIQUE }, postState: preState };
        } else {
          continue;
        }
      }
    }
  
    // 3) integrate the incoming preimages into the postState
    for (const p of input.preimages) {
      

      // i) Check if there is an existing account for p.requester and if not throw error, if so then update. 
      const requester = p.requester;
      const account: AccountsMapEntry | undefined = postState.accounts.find((account) => account.id === requester);
      if (!account) {
        return { output: { err: ErrorCode.PREIMAGE_UNNEEDED }, postState: preState };
      }
      const metaEntry = account.data.lookup_meta.find((meta) => meta.key.length === p.blob.length);
      console.log("metaEntry", metaEntry);

      // ii) Compute hash of the blob
      const hash = blake2b(p.blob, undefined, 32);
      console.log("hashed blake2b", toHex(hash), hash);

      // iii) Check if there is an existing preimage for the hash and if so skip it 
      const alreadyExistsInPreimage = account.data.preimages.some((m) => compareBytes(m.hash, hash) === 0);
      console.log("alreadyExists", alreadyExistsInPreimage);
      if (alreadyExistsInPreimage) {
        console.log("alreadyExists", alreadyExistsInPreimage);
        return { output: { err: ErrorCode.PREIMAGE_UNNEEDED }, postState: preState };
       
      }

      const alreadyExistsInLookupMeta = account.data.lookup_meta.some((m) => compareBytes(m.key.hash, hash) === 0);
      if (alreadyExistsInLookupMeta) {
        console.log("alreadyExistsInLookupMeta", alreadyExistsInLookupMeta);
      }
      if (!alreadyExistsInLookupMeta) {
        // unneded preimage
        return { output: { err: ErrorCode.PREIMAGE_UNNEEDED }, postState: preState };
      }

      console.log("we are here", alreadyExistsInLookupMeta);

      // iv) Check if there is an existing meta entry for the hash length and if not throw error, if so then update
      if (!metaEntry) {
        // preimage unneeded
        return { output: { err: ErrorCode.PREIMAGE_UNNEEDED }, postState: preState };
      }

      if (metaEntry.value.length !== 0) {
        continue;
      }

      // v) integrate:
      //    - Insert (hash, blob) into the accounts preimages
      account.data.preimages.push({ hash, blob: p.blob });

      //    - Mark the meta as now available => metaEntry.value = [slot]
      metaEntry.value = [input.slot];
    }

    // 5) Sort each accounts preimages array by ascending hash
    for (const acc of postState.accounts) {
      acc.data.preimages.sort((a, b) => compareBytes(a.hash, b.hash));
    }
    

    // 4) Return
    return { output: { ok: null }, postState };
  }
  


  function compareBlob(a: Uint8Array, b: Uint8Array): number {
    for (let i = 0; i < 32; i++) {
      if (a[i] !== b[i]) 
        return a[i] - b[i];
    }
    return 0;
  }
  
  
  function isLexicographicallyAscending(prev: Uint8Array, curr: Uint8Array): boolean {
    return compareBlob(prev, curr) < 0;
  }