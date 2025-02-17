import nacl from "tweetnacl";

export function buildDisputeMessageVerdict(
  target: Uint8Array,
  vote: boolean
): Uint8Array {
  const labelStr = vote ? "jam_valid" : "jam_invalid";
  return concatLabelPlusTarget(labelStr, target);
}

export function buildDisputeMessageCulprit(
  target: Uint8Array
): Uint8Array {
  return concatLabelPlusTarget("jam_guarantee", target);
}

export function buildDisputeMessageFault(
  target: Uint8Array,
  vote: boolean
): Uint8Array {
  const labelStr = vote ? "jam_valid" : "jam_invalid";
  return concatLabelPlusTarget(labelStr, target);
}


function concatLabelPlusTarget(label: string, target: Uint8Array): Uint8Array {
  const labelBytes = new TextEncoder().encode(label);
  const out = new Uint8Array(labelBytes.length + target.length);
  out.set(labelBytes, 0);
  out.set(target, labelBytes.length);
  return out;
}

/**
 * Verifies a raw Ed25519 signature with tweetnacl.
 * @param message  The exact data the signer must have used.
 * @param signature  64 bytes
 * @param publicKey  32 bytes
 */
export function verifyDisputeSignature(
  message: Uint8Array,
  signature: Uint8Array,
  publicKey: Uint8Array
): boolean {
  if (publicKey.length !== 32 || signature.length !== 64) {
    return false; 
  }
  try {
    return nacl.sign.detached.verify(message, signature, publicKey);
  } catch {
    return false;
  }
}
