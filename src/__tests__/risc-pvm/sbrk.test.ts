import { buildBlob }          from "../../risc-pvm/interpreter/deblob";
import { Opcodes }            from "../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }            from "../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }     from "../../risc-pvm/interpreter/types";

/* A.7 Heap bounds test. 

Helper: create a tiny blob that
   1) loads an immediate SIZE into r1
   2) calls sbrk r0 <- r1
   3) traps                                                          
*/
function buildSbrkBlob(size: number): Uint8Array {

  const immLE = Uint8Array.of(
    size & 0xFF,
    (size >> 8) & 0xFF, // little-endian we mask because 
    (size >> 16) & 0xFF, // 3 bytes for size
    (size >> 24) & 0xFF, // (size >> 32) & 0xFF, // 4th byte is always zero
    // above is a total of 4 bytes for size
  );

  const code = Uint8Array.of(
    Opcodes.load_imm, 0x00,          // r1 = SIZE
    ...immLE,
    Opcodes.sbrk, 0x00, 0x01,        // sbrk r0, r1
    Opcodes.trap,                    // stop
  );

  const bitmask = Uint8Array.of(0b01000001, 0b000000010);

  return buildBlob({
    meta:        Uint8Array.of(0),
    jumpTbl:     Uint8Array.of(0),
    z:           1,
    instr:       code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
}

describe("sbrkHandler – heap allocation", () => {
  const HEAP_START = 0x00010000; // which is 64 KB in hex and in 0b is 0b00000000000000010000000000000000
  const HEAP_END   = 0x00012000;  // 8 KB heap for tests in 0b is    // 0b00000000 00000001 00100000 00000000
  const MEM_SIZE   = HEAP_END; // total RAM

  it("allocates inside heap and returns old pointer", () => {
    const blob  = buildSbrkBlob(0x20); // request 32 bytes in extra heap space (0b00100000)
    const state = runBlob(
        blob, 
        500n, // gas
    {
      heapStart: HEAP_START,
      heapEnd:   HEAP_END,
      memSize:   MEM_SIZE,
    });

    // r0 contains previous heap pointer (0x10000)
    expect(state.registers[0]).toBe(BigInt(HEAP_START));

    // heapPointer advanced
    expect(state.context!.heapPointer).toBe(HEAP_START + 0x20);
    expect(state.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("panics on heap overflow", () => {
    const oversize = HEAP_END - HEAP_START + 4; // 4 bytes too many
    const blob  = buildSbrkBlob(oversize);
    const state = runBlob(blob, 500n, {
      heapStart: HEAP_START,
      heapEnd:   HEAP_END,
      memSize:   MEM_SIZE,
    });

    // expect Panic due to heap overflow
    expect(state.exit?.type).toBe(ExitReasonType.Panic);
  });
});
