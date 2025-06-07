import { buildBlob, deblob, deblobMetadata } from '../../risc-pvm/interpreter/deblob';

describe("deblob helpers", () => {
    const META          = Uint8Array.of(0xaa, 0xbb);
    const JUMPTBL       = Uint8Array.of(0x01); 
    const z             = 1 as const;
    const JUMP_ENTRIES  = [ Uint8Array.of(0x05) ]; 
    const CODE          = Uint8Array.of(0xde, 0xad); // opcodes + operands
    const BITMASK       = Uint8Array.of(0x80);       // one opcode at bit-7
  
    const BLOB = buildBlob({
      meta: META,
      jumpTbl: JUMPTBL,
      z,
      instr: CODE,
      jumpEntries: JUMP_ENTRIES,
      bitmaskBits: BITMASK,
    });
  
    // deblob metadata
    it("deblobMetadata strips exact metadata prefix", () => {
      const {metadata: metadata, blob: blob} = deblobMetadata(BLOB);
      console.log ("metadata and blob:", {metadata, blob});
      // first byte was 2, next 2 bytes are 0xaa 0xbb -> metadata[0] should be 170 (0xaa)
      console.log("stripped metadat:", metadata);
      expect(metadata[0]).toBe(0xaa); // 0xaa
      expect(metadata[1]).toBe(0xbb);
    });
  
    it("deblobMetadata throws on malformed prefix", () => {
      // metadata length = 9 but only 3 bytes follow
      const malformed = Uint8Array.of(9, 0x01, 0x02, 0x03);
      expect(() => deblobMetadata(malformed)).toThrow();
    });
  
    // deblob full
    it("deblob correctly splits all segments", () => {
      const out = deblob(BLOB);
      console.log(" CODE:", CODE);
    
      expect(out.jumpTable).toEqual(JUMPTBL);
      expect(out.jumpIndexSize).toBe(z);
      expect(out.instructionData).toEqual(CODE);
      expect(out.jumpEntries).toEqual(JUMP_ENTRIES);
      expect(out.opcodeBitmask).toEqual(BITMASK);
    });
  
    it("deblob rejects bogus jump-index size", () => {
      expect(() => buildBlob({
        meta: META,
        jumpTbl: JUMPTBL,
        z: 3 as any, // invalid size
        instr: CODE,
        jumpEntries: [Uint8Array.of(0x01, 0x02, 0x03)], 
        bitmaskBits: BITMASK,
      })).toThrow(/Invalid jump index size/);
    });
  
    it("deblob rejects trailing bytes", () => {
      const extra = new Uint8Array([...BLOB, 0x00, 0x00]);
      expect(() => deblob(extra)).toThrow(/trailing/);
    });
  });