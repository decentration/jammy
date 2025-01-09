import { sha256 } from "@noble/hashes/sha256";
import { ExtrinsicData } from "../../types/types";
import { ExtrinsicDataCodec } from "./ExtrinsicData";

/**
 * Compute Merkle root of extrinsics
 * Placeholder: Single hash of all extrinsics.
 */
export function computeExtrinsicsMerkleRoot(extrinsics: ExtrinsicData): Uint8Array {
  const serializedExtrinsics = ExtrinsicDataCodec.enc(extrinsics);
  return sha256(serializedExtrinsics);
}