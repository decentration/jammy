import { Codec } from "scale-ts";
import { TicketBodyCodec } from "../../codecs";
import type { TicketsMark } from "../../types/types";
import { DiscriminatorCodec } from "../../codecs/DiscriminatorCodec";
import { EPOCH_LENGTH } from "../../consts";
/** 
 * We want at most 12 items => { maxSize: 12 }
 */
export const TicketsAccumulatorCodec: Codec<TicketsMark[]> = DiscriminatorCodec<TicketsMark>(
  TicketBodyCodec,
  { maxSize: EPOCH_LENGTH }
);
