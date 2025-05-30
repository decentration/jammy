
import { concat } from "fp-ts/lib/ReadonlyNonEmptyArray";
import { concatAll, decodeProtocolInt, encodeProtocolInt, VarLenBytesCodec } from "../../codecs";

/* deblob extracts key fields from the blob. 
 * first we need to get the blob check the first byte to see the number decode it into decimal then we 
 * skip the next amount of bytes and extract the blob without the metadata. 
 * (A.2) in A.1. 
 * E(|j|) jump table has length 1 byte.
 * E1(z) each jump index is    4 bytes 
 * E(|c|) instruction stream of length 12 bytes.
 * Ez(j) 1 jump entry (4 bytes)
 * E(c) opcodes and operands
 * E(k)
 * |k| is opcode bitmask, 
 * |c| is the instruction data of opcodes and operands,
 * |k| is |c| because every byte of |k| represents whether |c| is an opcode `1` or an operand `0`. 
 * deblob is a concatenation of seven parts 
 * 
*/
export function deblob(wholeBlob: Uint8Array): {
    jumpTable: Uint8Array;
    jumpIndexSize: number;
    instructionData: Uint8Array;
    jumpEntries: Uint8Array[];
    opcodesAndOperands: Uint8Array;
    opcodeBitmask: Uint8Array;
  } {
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
  const jumpIndexSize = blob[offset];
  offset += 1;

  if (![1, 2, 4].includes(jumpIndexSize)) {
    throw new Error(`Invalid jump index size (z=${jumpIndexSize}); expected 1, 2 or 4`);
  }

  // 3) Instruction data size: E(|c|)
  const { value: instructionDataLength, bytesRead: idLenBytes } = decodeProtocolInt(blob.slice(offset));
  offset += idLenBytes;

  if (blob.length < offset + instructionDataLength) {
    throw new Error('Blob too short for instruction data');
  }

  const instructionData = blob.slice(offset, offset + Number(instructionDataLength));
  offset += Number(instructionDataLength);

  // 4) jump entries Ez(j): array of entries, each entry z bytes
  const jumpEntries: Uint8Array[] = [];
  const jumpEntriesTotalBytes = Number(jumpTableLength) * jumpIndexSize;

  if (blob.length < offset + jumpEntriesTotalBytes) {
    throw new Error('Blob too short for jump entries');
  }

  for (let i = 0; i < jumpTableLength; i++) {
    const entry = blob.slice(offset, offset + jumpIndexSize);
    jumpEntries.push(entry);
    offset += jumpIndexSize;
  }

  // 5) Opcodes and operands E(c): length-prefixed bytes
  const opcodesAndOperands = VarLenBytesCodec.dec(blob.slice(offset));
  const opcodesAndOperandsEncoded = VarLenBytesCodec.enc(opcodesAndOperands);
  offset += opcodesAndOperandsEncoded.length;

  // 6) Opcode bitmask E(k): length-prefixed bytes (bitmask for opcodes)
  const opcodeBitmask = VarLenBytesCodec.dec(blob.slice(offset));
  offset += VarLenBytesCodec.enc(opcodeBitmask).length;

  // Ensure no trailing unexpected data 
  if (offset !== blob.length) {
    throw new Error(`Unexpected trailing data (offset=${offset}, length=${blob.length})`);
  }

  return {
    jumpTable,
    jumpIndexSize,
    instructionData,
    jumpEntries,
    opcodesAndOperands,
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
    jumpTbl,
    z,
    instr,
    jumpEntries,
    codeBytes,
    bitmaskBytes,
  }: {
    meta: Uint8Array;
    jumpTbl: Uint8Array;
    z: 1 | 2 | 4;
    instr: Uint8Array;
    jumpEntries: Uint8Array[];
    codeBytes: Uint8Array;
    bitmaskBytes: Uint8Array;
  }): Uint8Array {
    
    const parts: Uint8Array[] = [];
  
    // metadata
    parts.push(new Uint8Array([meta.length]));
    parts.push(meta);
  
    // jump-table + sizes
    parts.push(encodeProtocolInt(jumpTbl.length));
    parts.push(jumpTbl);
    parts.push(new Uint8Array([z]));
  
    // instruction data
    parts.push(encodeProtocolInt(instr.length));
    parts.push(instr);
  
    // jump entries
    for (const je of jumpEntries) parts.push(je);
  
    // code + bitmask (VarLen encoded
    parts.push(VarLenBytesCodec.enc(codeBytes));
    parts.push(VarLenBytesCodec.enc(bitmaskBytes));
  
    const blob = concatAll(...parts);
    return blob;
}