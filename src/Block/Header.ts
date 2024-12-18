import { Codec, Struct, Vector, str, u32, Bytes, Option, StringRecord} from 'scale-ts';

export interface EpochMarker {
  nextRandomness1: Uint8Array; // η1'
  nextRandomness2: Uint8Array; // η2'
  validatorKeys: Uint8Array[]; // [kb | k ∈ γk']
}

export const EpochMarkerCodec = Struct({
  nextRandomness1: Bytes(32),
  nextRandomness2: Bytes(32),
  validatorKeys: Vector(Bytes(32)),
});



export interface Header {
  parentHash: Uint8Array;             // Hp: Parent hash
  priorStateRoot: Uint8Array;         // Hr: Prior state root
  extrinsicHash: Uint8Array;          // Hx: Extrinsic hash
  timeSlotIndex: number;          // Ht: Time-slot index
  epochMarker?: EpochMarker;                // He: Epoch marker
  winningTickets?: Uint8Array[];    // Hw: Winning-tickets
  offenders: Uint8Array[];            // Ho: Offenders
  blockAuthorIndex: number;       // Hi: Bandersnatch block author index
  vrfSignature: Uint8Array;           // Hv: Entropy-yielding VRF signature
  blockSeal?: Uint8Array;              // Hs: Block seal
}

export const HeaderCodec = Struct({
  parentHash: Bytes(32),
  priorStateRoot: Bytes(32),
  extrinsicHash: Bytes(32),
  timeSlotIndex: u32,
  epochMarker: Option(EpochMarkerCodec),  
  winningTickets: Option(Vector(Bytes(32))), 
  offenders: Vector(Bytes(32)),
  blockAuthorIndex: u32,
  vrfSignature: Bytes(64),
  blockSeal: Option(Bytes(64)),             
});


      
// with seal
export function serializeHeader(header: Header): Uint8Array {
  return HeaderCodec.enc({
    ...header,
    epochMarker: header.epochMarker || undefined,
    winningTickets: header.winningTickets || undefined, 
    blockSeal: header.blockSeal || undefined, 
  });
}

//  without Seal
export function serializeHeaderWithoutSeal(header: Header): Uint8Array {
  const { blockSeal, ...headerWithoutSeal } = header;
  return HeaderCodec.enc({
    ...headerWithoutSeal,
    epochMarker: header.epochMarker || undefined,
    winningTickets: header.winningTickets || undefined,
    blockSeal: header.blockSeal || undefined,
  });
}

export function deserializeHeader(data: Uint8Array): Header {
  const decoded = HeaderCodec.dec(data);

  return {
    ...decoded,
    epochMarker: decoded.epochMarker || undefined,
    winningTickets: decoded.winningTickets || undefined,
  };
}