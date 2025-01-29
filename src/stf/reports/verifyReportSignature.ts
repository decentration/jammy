import nacl from "tweetnacl";
import { buildSignatureMessage } from "./verifyReportSignature";


// TODO convert to reports from assurances (11.26)

/**
 * Checks Ed25519 signature as per eq. 11.13 in the Jam paper:
 *   - Scale-encode (anchor, bitfield)
 *   - blake2b(32) hash
 *   -  prepend "jam_available" not the "$" label ($jam_available won't work)
 *   - Ed25519 verify
 *
 * @param anchor    32-byte parent block hash
 * @param bitfield  bitfield for core availability (1..n bytes) 1 for tiny. 
 * @param signature 64-byte Ed25519 signature
 * @param publicKey 32-byte Ed25519 public key
 * @returns True if valid, false if invalid or an error occurs
 */
export async function verifyAssuranceSignature(
  anchor: Uint8Array,
  bitfield: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): Promise<boolean> {
  // length checks
  if (signature.length !== 64) {
    return false;
  }
  if (publicKey.length !== 32) {
    return false;
  }

  console.log("anchor, bitfield, signature, publicKey", { anchor, bitfield, signature, publicKey });

  // 2) Build message from (anchor, bitfield
  const finalMsg = buildSignatureMessage(anchor, bitfield);

  console.log("finalMsg", finalMsg);

  // 3)  Ed25519 verify
  try {
    const isValid = nacl.sign.detached.verify(finalMsg, signature, publicKey);
    console.log("Is signature valid =>", isValid);
    return isValid;
  } catch (err) {
    return false;
  }
}
