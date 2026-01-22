import { buildBlob } from "../../risc-pvm/interpreter/deblob";
import { Opcodes } from "../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../risc-pvm/interpreter/types";

function blob(code: Uint8Array, bitmask: Uint8Array) {
  return buildBlob({
    meta: Uint8Array.of(0),
    z: 1,
    instr: code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
}

/* page size = 4 KiB = 0x1000 (ZP per GP 4.24-4.25)
   memory layout shared by all tests:

   0x00000‥0x00FFF   page-0   code  (RO)
   0x01000‥0x01FFF   page-1   code  (RO)
   ...
   0x10000‥0x10FFF   page-16  heap start (RW)
   0x11000‥0x11FFF   page-17  heap  (RW)
   0x12000‥0x12FFF   page-18  heap  (RW)
   ...
   0x17000‥0x17FFF   page-23  heap end
   0x18000‥...       unmapped
*/
const memOpts = {
  memSize: 0x20000,   // 128 KiB = 32 pages of 4 KiB
  heapStart: 0x10000,   // page 16
  heapEnd: 0x18000,   // page 24
  strictVm: false,     // Allow non-Halt exits to be returned
};

describe("memory-protection tests (4KiB pages)", () => {
  it("1. READ fault on unmapped page - load_ind_u8 faults on address 0x1F000 (page 31)", () => {
    // Access address 0x1F000 which is page 31, beyond heapEnd (page 24) and unmapped
    const code = Uint8Array.of(
      Opcodes.load_imm, 0x01, 0x00, 0xF0, 0x01, 0x00,   // r1 = 0x1F000 (little-endian)
      Opcodes.load_ind_u8, (1 << 4) | 0, 0x00,          // load r0,[r1+0]
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b00000010);  // positions 0, 6, 9

    const s = runBlob(blob(code, bitmask), 100n, memOpts);
    expect(s.exit?.type).toBe(ExitReasonType.PageFault);
    expect(s.exit?.detail).toBe(0x1F);        // page 31 = 0x1F
  });

  it("2. store_ind_u32 crossing heap→unmapped boundary faults", () => {
    // Try to write at 0x17FFE which crosses from page 23 (heap, RW) to page 24 (unmapped)
    // 0x17FFE in little-endian: FE, 7F, 01, 00
    const code = Uint8Array.of(
      Opcodes.load_imm, 0x00, 0x78, 0x56, 0x34, 0x12,              // r0 = 0x12345678
      Opcodes.load_imm, 0x01, 0xFE, 0x7F, 0x01, 0x00,              // r1 = 0x17FFE
      Opcodes.store_ind_u32, (1 << 4) | 0, 0x00,                   // store r0,[r1]
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b10010000);  // positions 0, 6, 12, 15

    const s = runBlob(blob(code, bitmask), 200n, memOpts);
    expect(s.exit?.type).toBe(ExitReasonType.PageFault);
    expect(s.exit?.detail).toBe(0x18);  // page 24 is unmapped
  });

  it("3. store_ind_u8 succeeds inside heap page", () => {
    // Write at 0x10004 which is inside heap (page 16)
    const code = Uint8Array.of(
      Opcodes.load_imm, 0x00, 0xAA, 0x00, 0x00, 0x00,   // r0 = 0xAA
      Opcodes.load_imm, 0x01, 0x04, 0x00, 0x01, 0x00,   // r1 = 0x10004
      Opcodes.store_ind_u8, (1 << 4) | 0, 0x00,         // store r0,[r1]
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b10010000);

    const s = runBlob(blob(code, bitmask), 50n, memOpts);
    expect(s.exit?.type).toBe(ExitReasonType.Panic); // trap
    expect(s.memory[0x10004]).toBe(0xAA);
  });

  it("4. write to code page faults", () => {
    // Try to write at 0x1000 which is in code area (page 1, RO)
    const code = Uint8Array.of(
      Opcodes.load_imm, 0x00, 0x11, 0x22, 0x33, 0x44,
      Opcodes.load_imm, 0x01, 0x00, 0x10, 0x00, 0x00,  // r1 = 0x1000 (page 1)
      Opcodes.store_ind_u8, (1 << 4) | 0, 0x00,
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b10010000);

    const s = runBlob(blob(code, bitmask), 50n, memOpts);
    // Should fault because code pages are read-only
    expect(s.exit?.type).toBe(ExitReasonType.PageFault);
    expect(s.exit?.detail).toBe(0x1);  // page 1
  });

  it("5. sbrk can extend heap exactly to heapEnd", () => {
    const heapDelta = memOpts.heapEnd - memOpts.heapStart; // 0x8000

    const code = Uint8Array.of(
      Opcodes.load_imm, 0x01,
      heapDelta & 0xFF,
      (heapDelta >> 8) & 0xFF,
      (heapDelta >> 16) & 0xFF,
      (heapDelta >> 24) & 0xFF,
      Opcodes.sbrk, 0x10,            // rD=0, rA=1
      Opcodes.trap,
    );

    const bitmask = Uint8Array.of(0b0100_0001, 0b0000_0001);

    const s = runBlob(blob(code, bitmask), 100n, memOpts);
    expect(s.exit?.type).toBe(ExitReasonType.Panic);        // trap
    expect(s.context!.heapPointer).toBe(memOpts.heapEnd);   // grew to limit
  });

  it("6. sbrk one byte beyond heapEnd panics", () => {
    const tooMuch = (memOpts.heapEnd - memOpts.heapStart) + 1;
    const code = Uint8Array.of(
      Opcodes.load_imm, 0x01,
      tooMuch & 0xFF,
      (tooMuch >> 8) & 0xFF,
      (tooMuch >> 16) & 0xFF,
      (tooMuch >> 24) & 0xFF,

      Opcodes.sbrk, 0x10,
      Opcodes.trap,
    );

    const bitmask = Uint8Array.of(
      0b0100_0001,
      0b0000_0001,
    );

    const s = runBlob(blob(code, bitmask), 100n, memOpts);
    expect(s.exit?.type).toBe(ExitReasonType.Panic); // overflow branch
    expect(s.exit?.detail).toBe("heap overflow");
  });
});
