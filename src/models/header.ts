
// TODO define very specific types for the header
export interface BlockHeader {
        parentHash: string;
        priorStateRoot: string;
        extrinsicHash: string;
        timeSlotIndex: number;
        epochMarker: number;
        winningTickets: string;
        judgmentsMarker: string;
        authorKey: string;
        bandersnatchKey: string;
        vrfSignature: string;
        blockSealHash: string;
      }

      
function serializeHeader(header: BlockHeader): BlockHeader  {
// TODO serialize header to octet strings as per 3.7.2
}

function deserializeHeader(data: string): BlockHeader {
// TODO 
}

