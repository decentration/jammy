import { Codec, Struct, Bytes, u8 }  from "scale-ts";
import { concatAll, decodeWithBytesUsed, toUint8Array, ValidatorsInfoCodec } from "../../../codecs";
import { TicketsAccumulatorCodec } from "../../../stf/safrole/codecs/TicketsAccumulatorCodec";
import { TicketsOrKeysCodec } from "../../../stf/safrole/codecs/TicketsOrKeysCodec";
import { BandersnatchRingRootCodec, TicketsMark } from "../../../types";
import { TicketsOrKeys } from "../../../stf/safrole/types";
import { ValidatorInfo } from "../../../stf/types";


export interface Gamma {
  gamma_k : ValidatorInfo[];
  gamma_z : Uint8Array;
  gamma_s : TicketsOrKeys;
  gamma_a : TicketsMark[];
}

// ENCODER
const encode: Codec<Gamma>[0] = (g): Uint8Array => {
  
  const parts: Uint8Array[] = [
    ValidatorsInfoCodec.enc(g.gamma_k),
    BandersnatchRingRootCodec.enc(g.gamma_z),
    TicketsOrKeysCodec.enc(g.gamma_s),
    TicketsAccumulatorCodec.enc(g.gamma_a)
  ];

  return concatAll(...parts);
};

// DECODER
const decode: Codec<Gamma>[1] = (data): Gamma => {
  const bytes = toUint8Array(data);
  let offset = 0;

  // decode gamma_k (exactly 2016 bytes)
  const gamma_k = ValidatorsInfoCodec.dec(bytes.subarray(offset, offset += 2016));

  // decode gamma_z (exactly 144 bytes)
  const gamma_z = BandersnatchRingRootCodec.dec(bytes.subarray(offset, offset += 144));

  // decode gamma_s (TicketsOrKeys discriminated union)
  const { value: gamma_s, bytesUsed: usedGammaS } =
    decodeWithBytesUsed(TicketsOrKeysCodec, bytes.subarray(offset));
  offset += usedGammaS;

  // decode gamma_a (TicketsAccumulator, variable-length)
  const gamma_a = TicketsAccumulatorCodec.dec(bytes.subarray(offset));

  return { gamma_k, gamma_z, gamma_s, gamma_a };
};

export const GammaCodec: Codec<Gamma> = [encode, decode] as any;
GammaCodec.enc = encode;
GammaCodec.dec = decode;


