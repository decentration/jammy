
import { concatAll, decodeProtocolInt, encodeProtocolInt, VarLenBytesCodec } from "../../codecs";


export interface DeconstructedBlob {
  jumpTable: Uint8Array;        // Ez(j)
  jumpEntryLength: number;        // z 
  instructionData: Uint8Array;  // E (c)
  jumpEntries: Uint8Array[];    // Ez(j) split by index
  opcodeBitmask: Uint8Array;    // E(k) 
}
/* deblob extracts key fields from the blob. 
 * first we need to get the blob check the first byte to see the number decode it into decimal then we 
 * skip the next amount of bytes and extract the blob without the metadata. 
 * (A.2) in A.1. 
 * E(|j|) jump table has length 1 byte.
 * E1(z) each jump index is    4 bytes 
 * E(|c|) instruction stream of length 12 bytes.
 * Ez(j) 1 jump entry (4 bytes)
 * E(k)
 * |k| is opcode bitmask, 
 * |c| is the instruction data of opcodes and operands,
 * |k| is |c| because every byte of |k| represents whether |c| is an opcode `1` or an operand `0`. 
 * deblob is a concatenation of seven parts 
 * 
*/
export function deblob(wholeBlob: Uint8Array): DeconstructedBlob {
    const { blob: blob } = deblobMetadata(wholeBlob);

    let offset = 0;

  // 1) Jump table length: E(|j|)
  const { value: jumpTableLength, bytesRead: jtLenBytes } = decodeProtocolInt(blob.slice(offset));
  offset += jtLenBytes;

  if (jumpTableLength < 1 || blob.length < offset + jumpTableLength) {
    throw new Error('Invalid jump table length or blob too short');
  }

  const jumpTable = blob.slice(offset, offset + Number(jumpTableLength));
  offset += Number(jumpTableLength);

  // 2) Jump index size (z): E1(z), single byte length
  if (blob.length <= offset) {
    throw new Error('Blob too short for jump index size');
  }
  const jumpEntryLength = blob[offset];
  if (jumpEntryLength === 0 || jumpEntryLength > 4) throw new Error(`Invalid jump index size: ${jumpEntryLength}. Must be 1-4 bytes.`);
  offset += 1;

  // 3) Instruction data size: E(|c|)
  const { value: instructionLength, bytesRead: idLenBytes } = decodeProtocolInt(blob.slice(offset));
  offset += idLenBytes;

  if (blob.length < offset + instructionLength) {
    throw new Error('Blob too short for instruction data');
  }

  // 4) jump entries Ez(j): array of entries, each entry z bytes
  const jumpEntries: Uint8Array[] = [];
  const jumpEntriesTotalBytes = jumpTableLength * jumpEntryLength;

  if (blob.length < offset + jumpEntriesTotalBytes) {
    throw new Error('Blob too short for jump entries');
  }

  for (let i = 0; i < jumpTableLength; i++) {
    const entry = blob.slice(offset, offset + jumpEntryLength);
    jumpEntries.push(entry);
    offset += jumpEntryLength;
  }

  // 5) Instruction data bytes: E(c) 
  const instructionData = blob.slice(offset, offset + instructionLength);
  offset += instructionLength;

  // 5) Opcode-bitmask  E(k)  (implicit length = ceil(|c|/8))
  const maskLen = Math.ceil((instructionLength) / 8);
  if (blob.length < offset + maskLen) {
  throw new Error("Blob too short for opcode bit-mask");
  }

  const opcodeBitmask = blob.slice(offset, offset + maskLen);
  offset += maskLen;

  // Ensure no trailing unexpected data 
  if (offset !== blob.length) {
    throw new Error(`Unexpected trailing data (offset=${offset}, length=${blob.length})`);
  }

  return {
    jumpTable,
    jumpEntryLength,
    instructionData,
    jumpEntries,
    opcodeBitmask,
  };
}


export function deblobMetadata ( blob: Uint8Array ): {
  metadata: Uint8Array;
  blob: Uint8Array;
} {
  console.log("deblobMetadata: blob", blob);
  if (blob.length < 1) throw new Error("Blob is too short");
  
  const metadataLength = blob[0]; // first byte is the metadata length
  // decode the byte into decimal
  if (metadataLength < 1 || metadataLength > 255) {
      throw new Error("Invalid metadata length");
  }
  if (blob.length < metadataLength + 1) {
      throw new Error("Blob is too short for the given metadata length");
  }
  // return metadata without prefix byte and blob without metadata
  return {
      metadata: blob.slice(1, metadataLength + 1),
      blob: blob.slice(metadataLength + 1),
  };
}


/* 
*  Helper that builds a minimal-valid program blob for testing.
*/
export function buildBlob({
    meta,
    jumpTbl, // raw bytes of jump table
    z,
    instr,
    jumpEntries,
    bitmaskBits,
  }: {
    meta: Uint8Array;
    jumpTbl: Uint8Array;
    z: 1 | 2 | 4;
    instr: Uint8Array;
    jumpEntries: Uint8Array[];
    bitmaskBits: Uint8Array;
  }): Uint8Array {

    if (jumpEntries.length !== jumpTbl.length) throw new Error(`jumpEntries.length (${jumpEntries.length}) != |j| (${jumpTbl.length})`);
  
    for (const e of jumpEntries) {
      console.log("e.length and z", e.length, z);
      if (e.length !== z) throw new Error(`every Ez(j) entry must be ${z}-byte(s)`);
    }

    if (![1, 2, 4].includes(z)) throw new Error(`Invalid jump index size: ${z}. Must be 1, 2, or 4 bytes.`);
    const needMask   = Math.ceil(instr.length / 8);
    console.log("bitmaskBits.length and needMask", bitmaskBits.length, needMask);
    if (bitmaskBits.length !== needMask) throw new Error(`bit-mask length ${bitmaskBits.length} != ceil(|c|/8) = ${needMask}`);
  
    const parts: Uint8Array[] = [];

    parts.push(new Uint8Array([meta.length]));
    parts.push(meta);
    parts.push(encodeProtocolInt(jumpTbl.length));
    parts.push(jumpTbl);
    parts.push(new Uint8Array([z])); 
    parts.push(encodeProtocolInt(instr.length));   
    for (const je of jumpEntries) parts.push(je);
    parts.push(instr);

    const needed = Math.ceil(instr.length / 8); // bit-mask k – raw, length must be ceil(|c|/8)
    if (bitmaskBits.length !== needed)
      throw new Error(`bitmask length issue: expected ${needed} but got ${bitmaskBits.length}`);

    parts.push(bitmaskBits);
      
    return concatAll(...parts);
}