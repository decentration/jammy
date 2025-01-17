import { SafroleState } from "../types";
import { hexStringToBytes } from "../../codecs/utils/"; 
import { TicketsMark } from "../../types/types";

/** 
 * parseSafroleStateJson: Convert a raw JSON object into a typed SafroleState
 */
export function parseSafroleStateJson(json: any): SafroleState {
  // 1) parse tau => number
  const tau = json.tau;

  // 2) parse eta => array of 4 x 32
  const eta = json.eta.map((hexStr: string) => hexStringToBytes(hexStr));

  // 3) parse validator sets => array(6) of validator info
  const parseValidatorInfo = (valJson: any) => ({
    bandersnatch: hexStringToBytes(valJson.bandersnatch),
    ed25519: hexStringToBytes(valJson.ed25519),
    bls: hexStringToBytes(valJson.bls),
    metadata: hexStringToBytes(valJson.metadata),
  });
  const lambda = json.lambda.map(parseValidatorInfo);
  const kappa = json.kappa.map(parseValidatorInfo);
  const gamma_k = json.gamma_k.map(parseValidatorInfo);
  const iota = json.iota.map(parseValidatorInfo);

  // 4) gamma_a => array( TicketsMark )
  const parseTicketsMark = (tb: any): TicketsMark => ({
    id: hexStringToBytes(tb.id),
    attempt: tb.attempt,
  });
  const gamma_a = json.gamma_a.map(parseTicketsMark);

  // 5) gamma_s => “tickets” or “keys”
  let gamma_s;
  if (json.gamma_s.tickets) {
    gamma_s = {
      tickets: json.gamma_s.tickets.map(parseTicketsMark),
    };
  } else if (json.gamma_s.keys) {
    gamma_s = {
      keys: json.gamma_s.keys.map((hexStr: string) => hexStringToBytes(hexStr)),
    };
  } else {
    throw new Error("parseSafroleStateJson: gamma_s missing `tickets` or `keys`");
  }

  // 6) gamma_z => 144 bytes
  const gamma_z = hexStringToBytes(json.gamma_z);

  // 7) post_offenders => array of Ed25519Public(32 bytes)
  const post_offenders = json.post_offenders.map((hexStr: string) => hexStringToBytes(hexStr));

  return {
    tau,
    eta,
    lambda,
    kappa,
    gamma_k,
    iota,
    gamma_a,
    gamma_s,
    gamma_z,
    post_offenders,
  };
}
