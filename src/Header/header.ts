
export interface BlockHeader {
        parentHash: Uint8Array;                // Hp
        priorStateRoot: Uint8Array;            // Hr
        extrinsicHash: Uint8Array;             // Hx
        timeSlotIndex: Uint8Array;             // Ht
        epochMarker: Uint8Array | null;        // He
        winningTickets:Uint8Array | null;      // Hw
        judgementsMarker: Uint8Array | null;   // Hj
        authorKey: Uint8Array;                 // Hk
        vrfSignature: Uint8Array;              // Hv // for entropy yielding // One of the bandersnatch keys
        blockSealHash?: Uint8Array;            // Hs // one of the bandersnatch keys
      }

      
