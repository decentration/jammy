import { SignatureInputCodec } from "./types";
import { blake2b } from "blakejs";
import { scaleEncodeAnchorBitfield } from "./utils";

// TODO: convert to reports from assurances (11.26)

/**
 * Builds the concatenated message for Ed25519 signature verification.
 * - Encodes (anchor, bitfield) using Scale.
 * - Hashes the encoded result.
 * - Appends the "$jam_available" label (if required).
 *
 * @param input The assurance input (anchor + bitfield)
 * @returns A Uint8Array representing the final message to be signed/verified.
 */

export function buildSignatureMessage(anchor: Uint8Array, bitfield: Uint8Array): Uint8Array {
  // 1) scale encode the anchor + bitfield
  const bitfieldLength = bitfield.length;
  const encoded = new Uint8Array(anchor.length + bitfieldLength);
  
  encoded.set(anchor, 0);
  encoded.set(bitfield, anchor.length);

  console.log("encoded", encoded);

  // 2) compute blake2b(32) hash
  const hashed = blake2b(encoded, undefined, 32);


  // 3) prepend the label "jam_available"
  const label = new TextEncoder().encode("jam_available");
  const finalMsg = new Uint8Array(label.length + hashed.length);
  finalMsg.set(label, 0);
  finalMsg.set(hashed, label.length);

  return finalMsg;
}

