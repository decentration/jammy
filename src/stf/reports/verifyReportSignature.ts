import nacl from "tweetnacl";
import { buildSignatureMessage } from "./buildSignatureMessage";
import { Report } from "../../types/types";



/**
 * Checks Ed25519 signature as per eq. 11.26 in GP:
 *   - blake2b(32) hash
 *   -  prepend "jam_guarantee" not the "$" label ($jam_guarantee won't work)
 *   - Ed25519 verify
 *
 * @param report Guarantee report type
 * @param signature 64-byte Ed25519 signature
 * @param publicKey 32-byte Ed25519 public key
 * @returns True if valid, false if invalid or an error occurs
 */
export async function verifyReportSignature(
  report: Report,
  signature: Uint8Array,
  publicKey: Uint8Array
  ): Promise<boolean> {
    const message = buildSignatureMessage(report);
    try {
      return nacl.sign.detached.verify(message, signature, publicKey);
    } catch {
      return false;
    }
  }
  