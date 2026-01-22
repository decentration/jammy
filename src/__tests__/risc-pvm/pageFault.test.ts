import { buildBlob } from "../../risc-pvm/interpreter/deblob";
import { Opcodes } from "../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../risc-pvm/interpreter/types";

describe("storeIndU32 page fault behaviour (4KiB pages)", () => {
  it("raises PageFault when writing to read-only code page", () => {
    // Try to write to address 0x2000 which is page 2 (code, RO)
    const code = Uint8Array.of(
      Opcodes.load_imm, 0x00, // r0
      0xEF, 0xBE, 0xAD, 0xDE,
      Opcodes.load_imm, 0x01, // r1 = 0x2000 (page 2, code area)
      0x00, 0x20, 0x00, 0x00,
      Opcodes.store_ind_u32,
      (1 << 4) | 0, // rB = 1 (upper nibble), rA = 0
      0x00,
      Opcodes.trap
    );

    const bitmask = Uint8Array.of(0b0100_0001, 0b1001_0000);

    const blob = buildBlob({
      meta: Uint8Array.of(0),
      jumpTbl: Uint8Array.of(0),
      z: 1,
      instr: code,
      jumpEntries: [Uint8Array.of(0)],
      bitmaskBits: bitmask,
    });

    // Memory layout (4KiB pages per Graypaper ZP):
    //  page 0-15: code (RO)         0x0000-0x10000
    //  page 16+:  heap (RW)         0x10000-0x18000
    //  page 24+:  unmapped          0x18000+
    const state = runBlob(blob, 200n, {
      memSize: 0x20000, // 128 KiB = 32 pages of 4 KiB
      heapStart: 0x10000, // page 16
      heapEnd: 0x18000, // page 24
      strictVm: false,   // Allow PageFault to be returned, not thrown
    });

    console.log("storeIndPageFault state", state);

    expect(state.exit?.type).toBe(ExitReasonType.PageFault);
    expect(state.exit?.detail).toBe(0x2); // page index 2 (0x2000 / 0x1000)
    // With 4KiB pages, page 16 is heap start
    expect(state.context?.pageTable[16]).toEqual({ read: true, write: true });
  });
});
