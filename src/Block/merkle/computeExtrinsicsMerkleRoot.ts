import { sha256 } from "@noble/hashes/sha256";
import { ExtrinsicData, AssuranceCodec, TicketCodec } from "../../types/types";
import { ExtrinsicDataCodec } from "../ExtrinsicData/ExtrinsicDataCodec";
import { PreimageCodec, GuaranteeCodec, DisputeCodec } from "../../codecs";
import { buildBinaryMerkleTree } from "./MerkleTree";
import { DiscriminatorCodec } from "../../codecs/DiscriminatorCodec";
import { wellBalancedMerkle } from "./wellBalancedMerkle";
/**
 * Compute Merkle root of extrinsics.
 * @param {ExtrinsicData} extrinsics - The extrinsic data.
 * @returns {Uint8Array} Merkle root of extrinsics.
 */
export function computeExtrinsicsMerkleRoot(extrinsics: ExtrinsicData): Uint8Array {


  const hasTickets = extrinsics.tickets.length > 0;
  const hasPreimages = extrinsics.preimages.length > 0;
  const hasGuarantees = extrinsics.guarantees.length > 0;
  const hasAssurances = extrinsics.assurances.length > 0;
  const hasDisputes = (
    extrinsics.disputes.verdicts.length > 0 ||
    extrinsics.disputes.culprits.length > 0 ||
    extrinsics.disputes.faults.length > 0
  );

  const isAllEmpty = !hasTickets && !hasPreimages && !hasGuarantees && !hasAssurances && !hasDisputes;
  if (isAllEmpty) {
    // Return a 32-byte zero array (TODO check if this is the correct way to handle empty extrinsics)
    return new Uint8Array(32);
  }


  const leafHashes: Uint8Array[] = [];

  const ticketCodec = DiscriminatorCodec(TicketCodec);
  const preimageCodec = DiscriminatorCodec(PreimageCodec);
  const guaranteeCodec = DiscriminatorCodec(GuaranteeCodec);
  const assuranceCodec = DiscriminatorCodec(AssuranceCodec);

  extrinsics.tickets.forEach(ticket => {
    const serialized = ticketCodec.enc([ticket]);
    leafHashes.push(sha256(serialized));
  });

  extrinsics.preimages.forEach(preimage => {
    const serialized = preimageCodec.enc([preimage]);
    leafHashes.push(sha256(serialized));
  });

  extrinsics.guarantees.forEach(guarantee => {
    const serialized = guaranteeCodec.enc([guarantee]);
    leafHashes.push(sha256(serialized));
  });

  extrinsics.assurances.forEach(assurance => {
    const serialized = assuranceCodec.enc([assurance]);
    leafHashes.push(sha256(serialized));
  });

  const serializedDisputes = DisputeCodec.enc(extrinsics.disputes);
  leafHashes.push(sha256(serializedDisputes));

  // Build merkle root from the leaf hashes
  return wellBalancedMerkle(leafHashes);
}
