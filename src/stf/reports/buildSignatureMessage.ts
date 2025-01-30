import { blake2b } from "blakejs";
import { Guarantee } from "../../types/types";
import { GuaranteeCodec } from "../../codecs";

// TODO: convert to reports from assurances (11.26)

/**
 * Builds the concatenated message for Ed25519 signature verification.
 * - Encodes report. 
 * - Hashes the encoded result.
 * - Appends "$jam_guarantee" label.
 *
 * @param input The reports input (report)
 * @returns A Uint8Array representing the final message to be signed/verified.
 */

export function buildSignatureMessage(report: Guarantee): Uint8Array {
  // 1) scale encode the report
  const encoded = GuaranteeCodec.enc(report);

  console.log("encoded", encoded);

  // 2) compute blake2b(32) hash
  const hashed = blake2b(encoded, undefined, 32);


  // 3) prepend the label "jam_guarantee"
  const label = new TextEncoder().encode("jam_guarantee");
  const finalMsg = new Uint8Array(label.length + hashed.length);
  finalMsg.set(label, 0);
  finalMsg.set(hashed, label.length);

  return finalMsg;
}

