import { buildBlob }      from "../../risc-pvm/interpreter/deblob";
import { Opcodes }        from "../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }        from "../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../risc-pvm/interpreter/types";

function blob(code: Uint8Array, bitmask: Uint8Array) {
  return buildBlob({
    meta:        Uint8Array.of(0),
    jumpTbl:     Uint8Array.of(0),
    z:           1,
    instr:       code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
}

/* page  size = 64 KiB = 0x10000
   memory layout shared by all tests:

   0x00000‥0x0FFFF   page-0  code  (RO)
   0x10000‥0x1FFFF   page-1  code  (RO / unmapped)
   0x20000‥0x2FFFF   page-2  code  (RO)   <- tests (1)(2) target
   0x30000‥0x37FFF   page-3  heap  (RW)   <- heap zone
   0x38000‥0x3FFFF   page-3 tail unused
   0x40000‥0x4FFFF   page-4  unmapped
   0x50000‥0x5FFFF   page-5  RO          <- test (5) target
   0x60000‥0x67FFF   page-6  heap  (RW)
*/
const memOpts = {
  memSize  : 0x70000,   // 7x64 KiB = 448 KiB
  heapStart: 0x30000,   // 0x30000 = 192 KiB
  heapEnd  : 0x38000,   // 0x38000 = 224 KiB   
};

describe("memory-protection tests", () => {
  it("1. READ fault on unmapped page (0x40000, page-4) load_ind_u8 faults on unreadable page 0x40000", () => {

    const code = Uint8Array.of(
      Opcodes.load_imm, 0x01,           0x00,0x00,0x04,0x00,   // r1 = 0x40000
      Opcodes.load_ind_u8, (1<<4)|0,    0x00,                  // load r0,[r1+0]
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b00000010);

    const s = runBlob(blob(code, bitmask), 100n, memOpts);
    console.log("memory-protection test 1 state", s);
    expect(s.exit?.type  ).toBe(ExitReasonType.PageFault);
    expect(s.exit?.detail).toBe(0x4);        // page-4
  });

  // 2  WRITE across boundary 2→3  (page-2 RO, page-3 RW)
  it("2. store_ind_u32 crossing RO→RW boundary faults on page-2", () => {

    const code = Uint8Array.of(
      Opcodes.load_imm, 0x00, 0x78,0x56,0x34,0x12,
      
      Opcodes.load_imm, 0x01,    0xFE,0xFF,0x02,0x00, // r1 = 0x2FFFE  (two bytes before page-3)
      // store_ind_u32 r0,[r1+0]  (writes 2 bytes in page-2, 2 in page-3)
      Opcodes.store_ind_u32, (1<<4)|0, 0x00,
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b00010000);

    const s = runBlob(blob(code, bitmask), 200n, memOpts);
    expect(s.exit?.type  ).toBe(ExitReasonType.PageFault);
    expect(s.exit?.detail).toBe(0x2);
  });

  // 3  WRITE succeeds inside heap 0x30004
  it("3. store_ind_u8 succeeds inside heap page-3", () => {

    const code = Uint8Array.of(
      Opcodes.load_imm, 0x00, 0xAA,0x00,0x00,0x00,   // r0 = 0xAA
      Opcodes.load_imm, 0x01, 0x04,0x00,0x03,0x00,   // r1 = 0x30004
      Opcodes.store_ind_u8,  (1<<4)|0, 0x00,         // store r0,[r1]
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b10010000
    );

    const s = runBlob(blob(code, bitmask), 50n, memOpts);
    expect(s.exit?.type).toBe(ExitReasonType.Panic); // trap
    expect(s.memory[0x30004]).toBe(0xAA);
  });


  it("4 - access below 0x10000 panics immediately", () => {

    const code = Uint8Array.of(
      Opcodes.load_imm, 0x00, 0x11,0x22,0x33,0x44,
      Opcodes.load_imm, 0x01, 0x00,0xF0,0x00,0x00,  // r1 = 0x0000F000
      Opcodes.store_ind_u8, (1<<4)|0, 0x00,
      Opcodes.trap,
    );
    const bitmask = Uint8Array.of(0b01000001, 0b10010000);

    const s = runBlob(blob(code, bitmask), 50n, memOpts);
    expect(s.exit?.type).toBe(ExitReasonType.Panic);
  });

  // test 5 – heap grows exactly to heapEnd 
  it("5. sbrk can extend heap exactly to heapEnd", () => {
      const heapDelta = memOpts.heapEnd - memOpts.heapStart; // 0x8000

      const code = Uint8Array.of(
      Opcodes.load_imm, 0x01,        // r1
          heapDelta & 0xFF,
          (heapDelta>>8) & 0xFF,
          (heapDelta>>16)& 0xFF,
          (heapDelta>>24)& 0xFF,
      Opcodes.sbrk, 0x10,            // rD=0, rA=1  (packed!)
      Opcodes.trap,
      );

      const bitmask = Uint8Array.of(0b0100_0001, 0b0000_0001);

      const s = runBlob(blob(code, bitmask), 100n, memOpts);
      expect(s.exit?.type).toBe(ExitReasonType.Panic);        // trap
      expect(s.context!.heapPointer).toBe(memOpts.heapEnd);   // grew to limit
  });


  // 6  sbrk overshoot by 1 => Panic “heap overflow”
  it("6. sbrk one byte beyond heapEnd panics", () => {

    const tooMuch = (memOpts.heapEnd - memOpts.heapStart) + 1;
    const code = Uint8Array.of(
        Opcodes.load_imm, 0x01,
          tooMuch & 0xFF,
          (tooMuch >> 8)  & 0xFF,
          (tooMuch >> 16) & 0xFF,
          (tooMuch >> 24) & 0xFF,
      
        Opcodes.sbrk, 0x10,  //  <- packed rA/rD byte
        Opcodes.trap,
      );
      
      const bitmask = Uint8Array.of(
        0b0100_0001,                 // indices 0,6
        0b0000_0001,                 // index 8
      );
      
    const s = runBlob(blob(code, bitmask), 100n, memOpts);
    expect(s.exit?.type ).toBe(ExitReasonType.Panic); // overflow branch
    expect(s.exit?.detail).toBe("heap overflow");
  });
});
