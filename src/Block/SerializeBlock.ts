import { BlockCodec } from "./BlockCodec";
import { sha256 } from '@noble/hashes/sha256';
import { Block} from "../types/types";
import { toHex } from "../utils";

export function serializeBlock(block: Block, unsigned: boolean = false): Uint8Array {
    if (!unsigned && block.header.seal && block.header.seal.length !== 96) {
      throw new Error("serializeBlock: Seal must be exactly 96 bytes");
    }
  
    const header = {
      ...block.header,
      seal: unsigned ? null : block.header.seal,
    };
  
    const fullEncoded = BlockCodec.enc({ header, extrinsic: block.extrinsic });
    if (unsigned && block.header.seal) {
      return fullEncoded.slice(0, fullEncoded.length - block.header.seal.length);
    }
  
    return fullEncoded;
  }
  

/**
 * helper function to compute "block hash" by:
 *  - Serializing block without seal (unsigned)
 *  - Hashing via SHA2-256
 */
export function generateBlockHash(block: Block): string {
  const unsignedBlock = serializeBlock(block, true);
  const hashBytes = sha256(unsignedBlock);
  console.log("Hash (raw Uint8Array):", hashBytes);
console.log("Hash length (raw Uint8Array):", hashBytes.length);
  return toHex(hashBytes);
}
