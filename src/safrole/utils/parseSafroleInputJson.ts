import { SafroleInput, TicketEnvelope } from "../types";
import { hexStringToBytes } from "../../codecs/utils";

export function parseSafroleInputJson(json: any): SafroleInput {
  const slot = json.slot;
  const entropy = hexStringToBytes(json.entropy); 

  // extrinsic => array of TicketEnvelope
  const parseTicketEnvelope = (env: any): TicketEnvelope => ({
    attempt: env.attempt,
    signature: hexStringToBytes(env.signature), 
  });
  const extrinsic = json.extrinsic.map(parseTicketEnvelope);

  return { slot, entropy, extrinsic };
}
