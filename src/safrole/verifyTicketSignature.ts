import { TicketVerifyContext, VerifyTicketOutput } from "./types";
import { ringVrfVerify } from "../ring-vrf-ffi/ring_vrf_ffi";
import { VALIDATOR_COUNT } from "../consts/tiny";

/**
 * Build the VRF input data: 
 *   jam_ticket_seal + entropy[2] + attempt
 */
function buildTicketInputData(
  entropy2: string,
  attempt: number
): Uint8Array {

  const sbuf     = Buffer.from('jam_ticket_seal', "utf-8"); 
  const sealBuf = new Uint8Array(sbuf.buffer, sbuf.byteOffset, sbuf.byteLength);
  const entropyBuf = Uint8Array.from(Buffer.from(entropy2, "hex"));
  const attemptBuf = new Uint8Array([attempt]);

  // combine the three buffers
  return new Uint8Array(Buffer.concat([sealBuf, entropyBuf, attemptBuf]).buffer);
}

/**
 * Verifies a ring VRF signature for a "ticket".
 * 
 * - context: TicketVerifyContext - context for the verification.
 * - signature: 784-byte ring VRF signature from ringVrfSign.
 *
 * Returns a VerifyTicketOutput object.
 */
export function verifyTicketSignature(
  context: TicketVerifyContext,
  signature: Uint8Array
): VerifyTicketOutput {
  // const { ringKeysStr, ringSize, srsPath, entropy2, attempt } = context;

  const ringKeysStr = context.ringKeysStr;
  const ringSize = VALIDATOR_COUNT;  // 6 or 1023
  const srsPath = "./ring-vrf/data/zcash-srs-2-11-uncompressed.bin";
  const entropy2 = context.entropy2;
  const attempt = context.attempt;

  // 1) build VRF input
  const inputData = buildTicketInputData(entropy2, attempt);

  // 2) empty `aux` i think:
  const auxData = new Uint8Array([]);

  // 3) call ringVrfVerify from ring_vrf_ffi
  const { ok, vrfOutput } = ringVrfVerify(
    ringKeysStr,
    ringSize,
    srsPath,
    inputData,
    auxData,
    signature
  );

  // reutrn the result and boolean perhaps

  return { ok, vrfOutput };
}
