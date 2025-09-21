import { buildBlob } from "../../risc-pvm/interpreter/deblob";
import { Opcodes } from "../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../risc-pvm/interpreter/types";

describe("storeIndU32 page fault behaviour", () => {
  it("raises PageFault when writing to read-only page 0x20000", () => {
    
    const code = Uint8Array.of(
        Opcodes.load_imm, 0x00, // r0
        0xEF, 0xBE, 0xAD, 0xDE,
        Opcodes.load_imm, 0x01, // r1
        0x00, 0x00, 0x02, 0x00,
        Opcodes.store_ind_u32,
        (1 << 4) | 0, // rB = 1 (upper nibble), rA = 0
        0x00,
        Opcodes.trap
    );

    const bitmask = Uint8Array.of(0b0100_0001, 0b1001_0000);
    
    const blob = buildBlob({
      meta:        Uint8Array.of(0), 
      jumpTbl:     Uint8Array.of(0),
      z:           1,
      instr:       code,
      jumpEntries: [Uint8Array.of(0)],
      bitmaskBits: bitmask,
    });

    // Memory layout:
    //  page 0-1 : code (RO)
    //  page 2   : code (RO) <- target 0x20000
    //  heap     : 0x30000-0x38000 (RW)
    const state = runBlob(blob, 200, {
      memSize:   0x40000, // 0x40000 = 256 KiB = 4 pages of 64 KiB
      heapStart: 0x30000, // = 192 KiB heap start = 3rd page
      heapEnd:   0x38000, // 224 KiB heap end = 3rd page end
    });

    console.log("storeIndPageFault state", state);

    expect(state.exit?.type).toBe(ExitReasonType.PageFault);
    expect(state.exit?.detail).toBe(0x2); // page index 2 (0x20000 / 0x10000)
    expect(state.context?.pageTable[3]).toEqual({ read: true, write: true }); // heap 
  });
});
