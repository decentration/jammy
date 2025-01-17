import { Codec } from "scale-ts";
import { TicketsMark, TicketBodyCodec } from "../../codecs";
import { DiscriminatorCodec } from "../../codecs/DiscriminatorCodec";
import { EPOCH_LENGTH } from "../../consts/tiny";
/** 
 * We want at most 12 items => { maxSize: 12 }
 */
export const TicketsAccumulatorCodec: Codec<TicketsMark[]> = DiscriminatorCodec<TicketsMark>(
  TicketBodyCodec,
  { maxSize: EPOCH_LENGTH }
);
