import { buildState } from "../../../risc-pvm/interpreter/buildState";
import { computeBasicBlockStarts } from "../../../risc-pvm/interpreter/computeBasicBlockStarts";
import { GAS_COST_JUMP } from "../../../risc-pvm/interpreter/consts";
import { executeSingleStep } from "../../../risc-pvm/interpreter/executeSingleStep";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { ExitReasonType, InterpreterState } from "../../../risc-pvm/interpreter/types";
import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { encodeProtocolInt } from "../../../codecs";
import { Bytes } from "scale-ts";
import { prettyState } from "../../../risc-pvm/interpreter/utils/debug";
import { nextPc } from "../../../risc-pvm/interpreter/instructions/instructionHandlers";
import { toLE, writeBytes } from "../../../risc-pvm/interpreter/instructions/helpers";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";


const MEM_OPTS = {
  memSize  : 0x40000, // 256 KiB -> 4x64 KiB pages
  heapStart: 0x30000, // page-3 is RW 
  heapEnd  : 0x38000, // 
};

const BASE      = 0x30040;
const BASE_LE   = Uint8Array.of(BASE & 0xFF, (BASE>>8)&0xFF, (BASE>>16)&0xFF); // in 0x is 0x0030040

const wrap = (code: Uint8Array, mask: Uint8Array) =>
  buildBlob({
    meta:        Uint8Array.of(0),
    jumpTbl:     Uint8Array.of(0),
    z:           1,
    instr:       code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: mask,
  });

// describe("Instruction execution tests", () => {

  // // 1) NO-OPERAND
  // it("trap (opcode 0) sets Panic exit reason", () => {
  //   const code = Uint8Array.of(Opcodes.trap);
  //   const bitmask = Uint8Array.of(0xff); // 8 bits enough for 1 opcode
  //   const state0 = buildState({ code, bitmask });
  //   const state1 = executeSingleStep(state0);

  //   expect(state1.exit?.type).toBe(ExitReasonType.Panic);
  //   expect(state1.pc).toBe(0);
  //   expect(state1.gas).toBe(state0.gas - 1);
  // });

  // // 2) FALLTHROUGH
  // it("fallthrough (opcode 1) increments PC without exiting", () => {
  //   const code = Uint8Array.of(Opcodes.fallthrough, Opcodes.trap);
  //   const bitmask = Uint8Array.of(0xff); // 8 bits enough for 2 opcodes
  //   const state0 = buildState({ code, bitmask });
  //   const state1 = executeSingleStep(state0);

  //   expect(state1.exit).toEqual({ type: ExitReasonType.Continue});  // Should NOT exit
  //   expect(state1.pc).toBe(1);            // Advance PC by 1
  //   expect(state1.gas).toBe(state0.gas - 1);
  // });

  // 3) ECALLI
  // it("ecalli (opcode 10) sets HostCall exit reason with immediate", () => {
  //   const code = Uint8Array.of(Opcodes.ecalli, 0x05);
  //   const bitmask = Uint8Array.of(0x01) // 1 on bit and 7 off bits for opcode 10
  //   const state0 = buildState({ code, bitmask });
  //   const state1 = executeSingleStep(state0);

  //   expect(state1.exit?.type).toBe(ExitReasonType.HostCall);
  //   expect(state1.exit?.id).toBe(5n);
  //   expect(state1.pc).toBe(2);
  //   expect(state1.gas).toBe(state0.gas - 10);
  // });

  // 4) LOAD_IMM_64
  // it("load_imm_64 (opcode 20) loads immediate into register", () => {
  //   const code    = Uint8Array.of(
  //       Opcodes.load_imm_64,
  //       0x02,                         // rA = 2
  //       0x08, 0x07, 0x06, 0x05,       // LE payload
  //       0x04, 0x03, 0x02, 0x01
  //     );
  //   const bitmask = Uint8Array.of(0b00000001, 0b00001000); 
  //   const state0 = buildState({ code, bitmask });
  //   const state1 = executeSingleStep(state0);

  //   expect(state1.registers[2]).toBe(0x0102030405060708n);
  //   expect(state1.pc).toBe(10);
  //   expect(state1.gas).toBe(state0.gas - 1);
  //   expect(state1.exit).toEqual({type: ExitReasonType.Continue});
  // });


  
  describe("A.5.9 store_imm_u{8,16,32,64}", () => {

    const HEAP_ADDR  = 0x30010; 
    const HEAP_ADDR_LE = Uint8Array.of(
      HEAP_ADDR & 0xFF, // 
      (HEAP_ADDR >> 8) & 0xFF, 
      (HEAP_ADDR >> 16) & 0xFF,
    );
  

    it("opcode 30 - store_imm_u8 writes one byte", () => {

      const code = Uint8Array.of(
        Opcodes.store_imm_u8,
        0x03,             // |vX|
        0x10, 0x00, 0x03, // vX LE HEAP_ADDR is 0x03
        0xAB,             // vY
        Opcodes.trap
      );

      const mask = Uint8Array.of(0b0100_0001);
      const vm = runBlob(wrap(code, mask), 50, MEM_OPTS);
 
      expect(vm.memory[HEAP_ADDR]).toBe(0xAB);
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);   // trap after write
    });
  
    it("opcode 31 - store_imm_u16 writes two bytes LE", () => {
      const code = Uint8Array.of(
        Opcodes.store_imm_u16,
        0x03,
        ...HEAP_ADDR_LE,
        0xEF, 0xBE,     // vY = 0xBEEF
        Opcodes.trap      
      );

      const mask = Uint8Array.of(0b1000_0001);
      const vm = runBlob(wrap(code, mask), 50, MEM_OPTS);

      console.log("vm memory slice", vm.memory.slice(HEAP_ADDR -10, HEAP_ADDR + 20));
  
      expect(Array.from(vm.memory.slice(HEAP_ADDR, HEAP_ADDR + 2))).toEqual([0xEF, 0xBE]);
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);
    });
  
    it("opcode 32 - store_imm_u32 writes four bytes LE", () => {
      const code = Uint8Array.of(
        Opcodes.store_imm_u32,
        0x03,
        ...HEAP_ADDR_LE,
        0xEF, 0xBE, 0xAD, 0xDE,    // 0xDEADBEEF
        Opcodes.trap
      );

      const mask = Uint8Array.of(0b0000_0001, 0b0000_0010);
      const vm = runBlob(wrap(code, mask), 60, MEM_OPTS);
  
      expect(vm.memory.slice(HEAP_ADDR, HEAP_ADDR + 4))
        .toEqual(Uint8Array.of(0xEF, 0xBE, 0xAD, 0xDE));
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);
    });
  
    it("opcode 33 - store_imm_u64 writes eight bytes LE", () => {
      const code = Uint8Array.of(
        Opcodes.store_imm_u64,
        0x03,
        ...HEAP_ADDR_LE,
        0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11,  // 0x1122334455667788
        Opcodes.trap
      );

      const mask = Uint8Array.of(0b0000_0001, 0b0010_0000);
      const vm = runBlob(wrap(code, mask), 80, MEM_OPTS);
  
      expect(vm.memory.slice(HEAP_ADDR, HEAP_ADDR + 8))
        .toEqual(Uint8Array.of(0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11));
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);
    });
  

    it("5. store_imm_u32 into RO code page triggers PageFault", () => {
      // address 0x0004 (inside page-0 = RO)
      const code = Uint8Array.of(
        Opcodes.store_imm_u32,
        0x03,
        0x04, 0x00, 0x10,     // is LE of 0x10004
        0xDE,0xAD,0xBE,0xEF,  // vY
        Opcodes.trap 
      );

      const mask = Uint8Array.of(0b0000_0001, 0b0000_0001);
      const vm = runBlob(wrap(code, mask), 50, MEM_OPTS);
  
      console.log("Page Fault state", prettyState(vm));
      expect(vm.exit?.type  ).toBe(ExitReasonType.PageFault);
      expect(vm.exit?.detail).toBe(16);   // page-index 16
    });
  });
  
  
  // 9) JUMP
  describe("executeSingleStep for jump (ONE_OFFSET)", () => {
    it("successfully jumps to valid basic block start", () => {
      // opcode 40 (jump), offset 5 bytes forward
      const code = Uint8Array.of(Opcodes.jump, 0x05, 0, 0, 0, Opcodes.fallthrough); 
      const bitmask = Uint8Array.of(0b0100001); 
      const state0 = buildState({ code, bitmask });
  
      //  execute the step
      const state1 = executeSingleStep(state0);

      console.log("State before and after jump execution:", {state0, state1});
  
      expect(state1.pc).toBe(5); //  jumped forward 5 bytes (opcode(1)+offset(5))
      expect(state1.exit?.type).toBe(ExitReasonType.Continue); 
      expect(state1.gas).toBe(state0.gas - GAS_COST_JUMP);
    });

    it("jumps to the immediate next byte (offset=1)", () => {
      const code = Uint8Array.of(Opcodes.jump, Opcodes.fallthrough, 0);
      const bitmask = Uint8Array.of(0b00000011);
      const state0 = buildState({ code, bitmask });
    
      const state1 = executeSingleStep(state0);
    
      expect(state1.pc).toBe(1);
      expect(state1.exit?.type).toBe(ExitReasonType.Continue);
    });

    it("panics if jump target is out of bounds", () => {
      const code = Uint8Array.of(Opcodes.jump, 10, 0, 0, 0);
      const bitmask = Uint8Array.of(0b00000001);
    
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0);
    
      expect(state1.exit?.type).toBe(ExitReasonType.Panic);
      expect(state1.pc).toBe(0); 
    });

    it("panics if jump target is not a basic block start", () => {
      const code = Uint8Array.of(Opcodes.jump, 3, 0, 0, Opcodes.load_i32);
      // bitmask => 0 and 4 are opcodes, index 3 is not an opcode
      // code length= 5 => jump from 0 + 3 = 3, but 3 is not an opcode => panic
      const bitmask = Uint8Array.of(0b0010001);
    
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0);
    
      expect(state1.exit?.type).toBe(ExitReasonType.Panic);
      expect(state1.pc).toBe(0);
    });
    
  
    it(" panics when jumping to invalid block start", () => {
      // opcode 40 (jump),  offset to invalid block (3 bytes forward)
      const code = Uint8Array.of(Opcodes.jump, 0x03);
      const bitmask = Uint8Array.of(0b00000001); // opcode at position 0
      const state0 = buildState({ code, bitmask });

      const state1 = executeSingleStep(state0);
  
      expect(state1.exit?.type).toBe(ExitReasonType.Panic); 
      expect(state1.pc).toBe(state0.pc); 
      expect(state1.gas).toBe(state0.gas - GAS_COST_JUMP);
    });
  });

  // // 10) JUMP_IND
  // describe("10.1 executeSingleStep for jump_ind (DYNAMIC_JUMP)", () => {
  //   it("successfully performs a dynamic jump via jump table to a valid basic block start", () => {
  //     const meta = new Uint8Array([0x00]);
  //     const jumpTbl = new Uint8Array([0x00, 0x01]); // two jump table entries
  //     const jumpEntries = [
  //       Uint8Array.of(0x03,0x00,0x00, 0x00), // 4 byte 3
  //       Uint8Array.of(0x0A, 0x00, 0x00, 0x00) // 4 byte 10
  //     ];
  //     console.log("Jump entries:", jumpEntries);
  //     const instr = Uint8Array.of(
  //       Opcodes.jump_ind, 0x01, 0x02, 0x00, 0x00, 0x00, 
  //       Opcodes.fallthrough,          // index 5
  //       0, 0, 0, 0, 0, 0, 0, 0, 0,    // filler
  //       Opcodes.fallthrough           // index 10
  //     );     

  //     // const bitmaskBits = Uint8Array.of(0b00010001, 0b01000000); 
  //     const bitmaskBits = Uint8Array.of(0b0001001, 0b00000100, 0b00000000);     
  //     const blob = buildBlob({ meta, jumpTbl, z: 4, instr, jumpEntries, bitmaskBits });
  //     console.log("Blob built:", blob);
  //     const state0 = buildState({ code: instr, bitmask: bitmaskBits, blob: blob });
  
  //     state0.registers[1] = 2n; // r1 = 2, immediate offset = 2 => address = 4
  
  //     // address = 4; jump index = (4/2)-1 = 1  => jump to jumpEntries[1] = 10
  //     const state1 = executeSingleStep(state0);
  //     console.log("State before and after jump_ind execution:", {state0: prettyState, state1: prettyState});
  
  //     expect(state1.pc).toBe(10);
  //     expect(state1.exit?.type).toBe(ExitReasonType.Continue);
  //   });
  // });

  // it("10.2 successfully performs a jump when register + offset points exactly to first jump entry", () => {
  //   const meta = Uint8Array.of(0x00);
  //   const jumpTbl = Uint8Array.of(0x00, 0x01);
  //   const jumpEntries = [
  //     Uint8Array.of(0x06, 0x00, 0x00, 0x00), // 4 byte 6
  //     Uint8Array.of(0x0D, 0x00, 0x00, 0x00)  // 4 byte 13
  //   ];

  //   const instr = Uint8Array.of(
  //     Opcodes.jump_ind, 0x02, 0x00, 0x00, 0x00, 0x00, 
  //     Opcodes.fallthrough,
  //     0, 0, 0, 0, 0, 0, 
  //     Opcodes.fallthrough 
  //   );

  //   const registers = Array(13).fill(0n);
  //   registers[2] = 2n;
  //   const bitmaskBits = Uint8Array.of(0b01000001, 0b00100000);
  //   const blob = buildBlob({ meta, jumpTbl, z: 4, instr, jumpEntries, bitmaskBits });
  //   const state0 = buildState({ code: instr, bitmask: bitmaskBits, blob ,
  //     registers
  //   });

  //   const state1 = executeSingleStep(state0);
  //   console.log("State before and after jump_ind execution:", {
  //     state0: prettyState(state0),
  //     state1: prettyState(state1),
  //   });    
  //   expect(state1.pc).toBe(6);
  //   expect(state1.exit?.type).toBe(ExitReasonType.Continue);
  // });

  // it("10.3 panics if the computed address is not aligned correctly", () => {
  //   const meta = Uint8Array.of(0x00);
  //   const jumpTbl = Uint8Array.of(0x00);
  //   const jumpEntries = [ Uint8Array.of(0x04, 0x00, 0x00, 0x00), ];

  //   const instr = Uint8Array.of(Opcodes.jump_ind, 0x00, 0x01, 0x00, 0x00, 0x00);
  //   const bitmaskBits = Uint8Array.of(0x01);
  //   const blob = buildBlob({ meta, jumpTbl, z: 4, instr, jumpEntries, bitmaskBits });
  //   const state0 = buildState({ code: instr, bitmask: bitmaskBits, blob });

  //   state0.registers[0] = 1n; // r0=1 + offset(1)=2, address=2 => misaligned (should be even)

  //   const state1 = executeSingleStep(state0);

  //   expect(state1.exit?.type).toBe(ExitReasonType.Panic);
  // });

  // it("10.4 panics if the jump index is out of bounds of the jump table", () => {
  //   const meta = Uint8Array.of(0x00);
  //   const jumpTbl = Uint8Array.of(0x00);
  //   const jumpEntries = [
  //     Uint8Array.of(0x03, 0x00, 0x00, 0x00),
  //   ];

  //   const instr = Uint8Array.of(Opcodes.jump_ind, 0x00, 0x08, 0x00, 0x00, 0x00);
  //   const bitmaskBits = Uint8Array.of(0x01);
  //   const blob = buildBlob({ meta, jumpTbl, z: 4, instr, jumpEntries, bitmaskBits });
  //   const state0 = buildState({ code: instr, bitmask: bitmaskBits, blob });

  //   state0.registers[0] = 10n; // large value leading to index out of bounds

  //   const state1 = executeSingleStep(state0);

  //   expect(state1.exit?.type).toBe(ExitReasonType.Panic);
  // });

  // it("10.5 panics if jumping to a non-basic-block start address", () => {
  //   const meta = Uint8Array.of(0x00);
  //   const jumpTbl = Uint8Array.of(0x00, 0x01);
  //   const jumpEntries = [
  //     Uint8Array.of(0x02, 0x00, 0x00, 0x00), // invalid basic block start
  //     Uint8Array.of(0x07, 0x00, 0x00, 0x00),
  //   ];

  //   const instr = Uint8Array.of(
  //     Opcodes.jump_ind, 0x01, 0x00, 0x00, 0x00, 0x00,
  //     Opcodes.fallthrough,
  //     0, 0, 0, 0, 0,
  //     Opcodes.fallthrough
  //   );

  //   const bitmaskBits = Uint8Array.of(0x41, 0x04);
  //   const blob = buildBlob({ meta, jumpTbl, z: 4, instr, jumpEntries, bitmaskBits });
  //   const state0 = buildState({ code: instr, bitmask: bitmaskBits, blob });

  //   state0.registers[1] = 2n; // index=0, address=2 (not basic block start)

  //   const state1 = executeSingleStep(state0);

  //   expect(state1.exit?.type).toBe(ExitReasonType.Panic);
  // });

  // it("10.6 successfully performs jump to second jump entry", () => {
  //   const meta = Uint8Array.of(0x00);
  //   const jumpTbl = Uint8Array.of(0x00, 0x01, 0x02);
  //   const jumpEntries = [
  //     Uint8Array.of(0x03, 0x00, 0x00, 0x00),
  //     Uint8Array.of(0x06, 0x00, 0x00, 0x00),
  //     Uint8Array.of(0x09, 0x00, 0x00, 0x00),
  //   ];

  //   const instr = Uint8Array.of(
  //     Opcodes.jump_ind, 0x03, 0x03, 0x00, 0x00, 0x00,
  //     Opcodes.fallthrough, 
  //     0, 0,
  //     Opcodes.fallthrough, 
  //     0, 0,
  //     Opcodes.fallthrough 
  //   );

  //   const bitmaskBits = Uint8Array.of(0x49, 0x12);
  //   const blob = buildBlob({ meta, jumpTbl, z: 4, instr, jumpEntries, bitmaskBits });
  //   const state0 = buildState({ code: instr, bitmask: bitmaskBits, blob });

  //   state0.registers[3] = 1n;

  //   const state1 = executeSingleStep(state0);

  //   expect(state1.pc).toBe(6);
  //   expect(state1.exit?.type).toBe(ExitReasonType.Continue);
  // });





  describe("opcode 52 to 58 Absolute LOAD opcodes (now page-table aware)", () => {

    it("opcode 52:  load_u8 loads unsigned byte", () => {

      const code = Uint8Array.of(
        Opcodes.load_imm, 0x00,    0x7F,0,0,0, // 127
        Opcodes.store_u8, 0x30,    0x10,0x00,0x03, // 0x30010 (little-endian, 3 bytes)
        Opcodes.load_u8,  0x31,    0x10,0x00,0x03,
        Opcodes.trap
      );
      
      const mask = Uint8Array.of(
        0b0100_0001,
        0b0000_1000,
        0b0000_0001 
      );
      
      const vm = runBlob(wrap(code, mask), 120, MEM_OPTS);

      // console.log("State after load_u8 execution:", vm);
      expect(vm.memory[0x30010]).toBe(0x7F);
      console.log("Memory at 0x30010:", vm.memory[0x30010]);
      expect(vm.registers[1]).toBe(0x7Fn);
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);   // trap executed
    });
  
    it("opcode 53:  load_i8 sign-extends (0xFF -> −1)", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,     0xFF,0,0,0,             // r0 = 0xFF
        Opcodes.store_u8 , 0x30,     0x10,0x00,0x03,         // *(BASE)=0xFF
        Opcodes.load_i8  , 0x31,     0x10,0x00,0x03,         // r1 = *(BASE)
        Opcodes.trap
      );
      const mask = Uint8Array.of(
        0b0100_0001,
        0b0000_1000,
        0b0000_0001 
      );  
      const vm = runBlob(wrap(code, mask), 120, MEM_OPTS);
      console.log("VM memory base:", vm, vm.memory[BASE]);
      expect(vm.registers[1]).toBe(-1n);
    });
  
    it("opcode 54:  load_u16 loads 0xBEEF", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,        0xEF,0xBE,0,0,          // r0 = 0xBEEF
        Opcodes.store_u16, 0x30,        0x10,0x00,0x03,                         // *(BASE)=r0
        Opcodes.load_u16 , 0x31,        0x10,0x00,0x03,                         // r1 = *(BASE)
        Opcodes.trap
      );
      const mask = Uint8Array.of(
        0b0100_0001,
        0b0000_1000,
        0b0000_0001 
      );  
      const vm = runBlob(wrap(code, mask), 130, MEM_OPTS);
      expect(vm.registers[1]).toBe(0xBEEFn);
    });
  
    it("opcode 55:  load_i16 sign-extends 0x8000 -> −32768", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,     0x00,0x80,0,0,          // r0 = 0x8000
        Opcodes.store_u16, 0x30,     0x10,0x00,0x03,
        Opcodes.load_i16 , 0x31,     0x10,0x00,0x03,
        Opcodes.trap
      );
      const mask = Uint8Array.of(
        0b0100_0001,
        0b0000_1000,
        0b0000_0001 
      );  
      const vm = runBlob(wrap(code, mask), 130, MEM_OPTS);
      expect(vm.registers[1]).toBe(-32768n);
    });
  
    it("opcode 56 : load_u32 round-trips 0x12345678", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,     0x78,0x56,0x34,0x12,
        Opcodes.store_u32, 0x30,     0x10,0x00,0x03,
        Opcodes.load_u32 , 0x31,     0x10,0x00,0x03,
        Opcodes.trap
      );
      const mask = Uint8Array.of(
        0b0100_0001,
        0b0000_1000,
        0b0000_0001 
      );  
      const vm = runBlob(wrap(code, mask), 140, MEM_OPTS);
      expect(vm.registers[1]).toBe(0x12345678n);
    });
  
    it("opcode 57: load_i32 sign-extends 0x80000000 -> −2147483648", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,       0x00,0x00,0x00,0x80,
        Opcodes.store_u32, 0x30,       0x10,0x00,0x03,
        Opcodes.load_i32 , 0x31,       0x10,0x00,0x03,
        Opcodes.trap
      );
      const mask = Uint8Array.of(
        0b0100_0001,
        0b0000_1000,
        0b0000_0001 
      );  
      const vm = runBlob(wrap(code, mask), 140, MEM_OPTS);
      expect(vm.registers[1]).toBe(-2147483648n);
    });
  
    it("opcode 58: load_u64 round-trips 0x1122334455667788", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm_64, 0x00,
          0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11,          // r0
        Opcodes.load_imm, 0x01,     0x03, 0x10, 0x00, 0x03,
        Opcodes.store_u64, 0x10,    0x10, 0x00, 0x03,
        Opcodes.load_u64, 0x21,     0x10,0x00,0x03,
        Opcodes.trap
      );

      const mask = Uint8Array.of(
        0b0000_0001,
        0b0000_0100,
        0b0010_0001,
        0b0000_0100
      );  
      const vm = runBlob(wrap(code, mask), 200, MEM_OPTS);

      console.log("VM memory base:", vm, vm.memory[BASE]);
      expect(vm.registers[1]).toBe(0x1122334455667788n);
    });
  });


  describe("Absolute STORE opcodes 59-62 (respect permissions)", () => {

    it("opdcode 59: store_u8 writes one byte LE", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,     0xAA,0,0,0,  // 0xAA in decimal is 170
        Opcodes.store_u8 , 0x30,     0x10,0x00,0x03, // Heap address 0x30010
        Opcodes.trap
      );
      const mask = Uint8Array.of(
        0b0100_0001,
        0b0000_1000
      );    
      const vm = runBlob(wrap(code, mask), 90, MEM_OPTS);
      console.log("VM memory base:", vm, vm.memory[BASE]);
      expect(vm.memory[0x30010]).toBe(0xAA);
    });
  
    it("opcode 60: store_u16 writes 0xBEEF LE", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm, 0x00,        0xEF,0xBE,0,0,
        Opcodes.store_u16,0x00,        ...BASE_LE,
        Opcodes.trap
      );
      const mask = Uint8Array.of(0b0100_0001, 0b0000_1000);
  
      const vm = runBlob(wrap(code, mask), 90, MEM_OPTS);
      expect(Array.from(vm.memory.slice(BASE, BASE+2)))
        .toEqual([0xEF,0xBE]);
    });
  
    it("opcode 61: store_u32 writes 0xDEADBEEF LE", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm, 0x00,     0xEF,0xBE,0xAD,0xDE,
        Opcodes.store_u32,0x00,     ...BASE_LE,
        Opcodes.trap
      );
      const mask = Uint8Array.of(0b0100_0001, 0b0000_1000);
  
      const vm = runBlob(wrap(code, mask), 100, MEM_OPTS);
      expect(vm.memory.slice(BASE, BASE+4))
        .toEqual(Uint8Array.of(0xEF,0xBE,0xAD,0xDE));
    });
  
    it("opcode 62: store_u64 writes 0x1122334455667788 LE", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm_64, 0x00,
          0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11,
        Opcodes.store_u64 , 0x00,  ...BASE_LE,
        Opcodes.trap
      );
      const mask = Uint8Array.of(0b0000_0001, 0b1000_0100);
  
      const vm = runBlob(wrap(code, mask), 160, MEM_OPTS);
      expect(vm.memory.slice(BASE, BASE+8))
        .toEqual(Uint8Array.of(0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11));
    });
  
    it("store_u32 to RO code page -> PageFault", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm, 0x00,      0x0F,0xBE,0xAD,0x0E,
        Opcodes.store_u32,0x00,      0x08,0x00,0x01, 
        Opcodes.trap
      );
      const mask = Uint8Array.of(0b0100_0001, 0b0000_1000);
  
      const vm = runBlob(wrap(code, mask), 100, MEM_OPTS);
      expect(vm.exit?.type  ).toBe(ExitReasonType.PageFault);
      expect(vm.exit?.detail).toBe(1);
    });
  });
 
  const BASE2 = 0x30010;      // r0 will hold this address (inside heap)
  
  // in LE is 20 02 03 03n; // 4 bytes, 3 bytes LE which is 0x
  describe("A.5.9  store_imm_ind_u{8,16,32,64}", () => {

    it("70  store_imm_ind_u8 writes one byte at [r0+imm]", () => {
      const code = Uint8Array.of(
        Opcodes.load_imm, 0x00, 0x10, 0x00, 0x03,
        Opcodes.store_imm_ind_u8,
        0x10,    // ctl1 = 0x10  ->  rA=0  lX=1 
        0x04,    // vX=0x04
        0x5A,    // lY =1, vY=0x5A
        Opcodes.trap
      );
      const mask = Uint8Array.of(0b0010_0001, 0b0000_0010);
      const vm   = runBlob(wrap(code, mask), 60, MEM_OPTS);

      console.log("VM memory base:", vm, vm.memory[BASE2]);
      // lets log a range of memory 
      console.log("Memory range:", Array.from(vm.memory.slice(BASE - 50, BASE + 50)));

      const addr = 0x30010 + 4; // r0 + 4
      console.log("Memory at address 0x30010 + 4:", 0x30010, (0x30010 +4), vm.memory[addr]);
      expect(vm.memory[0x30010 + 4]).toBe(0x5A); 
      expect(vm.exit?.type).toBe(ExitReasonType.Panic); 
    });
  });


  // describe("A.5.8 One Register, One Immediate, One Offset instructions", () => {
  
  //   const regs = () => Array(13).fill(0n);

  //   it("80 load_imm_jump loads register and jumps", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.load_imm_jump,
  //       0x12,          // imm length 1 byte, reg 2-byte
  //       0x34,          // immX = 0x34
  //       0x06, 0, 0, 0, // offset = 6 (to trap opcode)
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  
  //     const s0 = buildState({ code, bitmask, registers: regs() });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(0x34n);
  //     expect(s1.pc).toBe(6);
  //     expect(s1.exit?.type).toBe(ExitReasonType.Continue);
  //   });
  
  //   it("81 branch_eq_imm jumps if register equals imm", () => {
  //     const offset = 6;  // Jump to the position of the next opcode (trap)
  //     const code = Uint8Array.of(
  //       Opcodes.branch_eq_imm,
  //       0x21,
  //       0x50, 0x00,  // imm = 0x0050
  //       0x06, 0x00, 0x00  // offset = 6 (valid block start)
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
    
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x50n;  // matches imm, triggers branch
    
  //     const state0 = buildState({ code, bitmask, registers: regs });
  //     const state1 = executeSingleStep(state0);
    
  //     expect(state1.pc).toBe(offset);
  //   });
  
  //   it("82 branch_ne_imm does NOT jump if register equals imm", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_ne_imm,
  //       0x11,
  //       0x50,
  //       0x06, 0, 0, 0,
  //       Opcodes.trap
  //     );
    
  //     const bitmask = Uint8Array.of(0b10000001);
    
  //     const r = Array(13).fill(0n);
  //     r[1] = 0x50n; // equal to immediate, thus NO branch
    
  //     const s0 = buildState({ code, bitmask, registers: r });
  //     const s1 = executeSingleStep(s0);
    
  //     expect(s1.pc).toBe(nextPc(s0)); 
  //     expect(s1.pc).toBe(7);
  //   });
  
  //   it("83 branch_lt_u_imm jumps if unsigned register is less than imm", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_lt_u_imm,
  //       0x11,
  //       0x05,
  //       0x06, 0, 0, 0
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x10n;
  
  //     const state0 = buildState({ code, bitmask, registers: regs });
  //     const state1 = executeSingleStep(state0);
  
  //     expect(state1.pc).toBe(6);
  //   });

  //   it("84 branch_le_u_imm jumps if unsigned register <= imm", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_le_u_imm,
  //       0x11, 0x03,
  //       0x06, 0, 0, 0,
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  
  //     const r = regs();
  //     r[1] = 0x03n;
  
  //     const s0 = buildState({ code, bitmask, registers: r });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.pc).toBe(6);
  //   });
    
  //   it("85 branch_ge_u_imm jumps if unsigned register >= imm", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_ge_u_imm,
  //       0x11, 0x03,
  //       0x06, 0, 0, 0,
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  
  //     const r = regs();
  //     r[1] = 0x05n;
  
  //     const s0 = buildState({ code, bitmask, registers: r });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.pc).toBe(6);
  //   });
    
  //   it("86 branch_gt_u_imm jumps if unsigned register > imm", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_gt_u_imm,
  //       0x11, 0x03,
  //       0x06, 0, 0, 0,
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  
  //     const r = regs();
  //     r[1] = 0x05n;
  
  //     const s0 = buildState({ code, bitmask, registers: r });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.pc).toBe(6);
  //   });
  
  
  //   it("87 branch_lt_s_imm jumps if signed register is less than imm", () => {
  //     const imm = -1;  // immediate as signed value (-1)
  //     const offset = 6; // valid basic block start
  //     const code = Uint8Array.of(
  //       Opcodes.branch_lt_s_imm,
  //       0x22,                   // immediate length=2, register=2
  //       imm & 0xff, (imm >> 8) & 0xff,  // LE immediate (-1 = 0xffff)
  //       offset, 0x00, 0x00,     // offset=6
  //       Opcodes.trap      // at position 6
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
    
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -10n;
    
  //     const state0 = buildState({ code, bitmask, registers: regs });
  //     const state1 = executeSingleStep(state0);
    
  //     expect(state1.pc).toBe(offset);
  //   });

  //   it("88 branch_le_s_imm jumps if signed register <= imm", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_le_s_imm,
  //       0x11, 0xFF,
  //       0x06, 0, 0, 0,
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  
  //     const r = regs();
  //     r[1] = -10n;
  
  //     const s0 = buildState({ code, bitmask, registers: r });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.pc).toBe(6);
  //   });
  
  //   it("89 branch_ge_s_imm jumps if signed register >= imm", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_ge_s_imm,
  //       0x11, 0x01,
  //       0x06, 0, 0, 0,
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  
  //     const r = regs();
  //     r[1] = 5n;
  
  //     const s0 = buildState({ code, bitmask, registers: r });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.pc).toBe(6);
  //   });

  //   it("90 branch_gt_s_imm jumps if signed register is greater than immediate", () => {
  //     const offset = 6;
  //     const code = Uint8Array.of(
  //       Opcodes.branch_gt_s_imm,
  //       0x22,
  //       0x00, 0x00, 
  //       offset, 0x00, 0x00, 0x00, 
  //       Opcodes.trap 
  //     );
    
  //     const bitmask = Uint8Array.of(0b01000001, 0b00000000);
    
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 1n; // register is 1 (greater than immediate 0)
    
  //     const state0 = buildState({ code, bitmask, registers: regs });
  //     const state1 = executeSingleStep(state0);
    
  //     expect(state1.pc).toBe(offset);
  //     expect(state1.exit?.type).toBe(ExitReasonType.Continue);
  //   });
  
  //   it("90 branch_gt_s_imm does NOT jump if signed register is less than imm", () => {
  //     const offset = 8; // valid basic block (trap at position 8)
    
  //     const code = Uint8Array.of(
  //       Opcodes.branch_gt_s_imm,
  //       0x22, 
  //       0x00, 0x00,
  //       offset, 0x00, 0x00, 0x00,
  //       Opcodes.trap
  //     );
    
  //     const bitmask = Uint8Array.of(0b00000001, 0b00000001);
    
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -1n; // condition false (reg < imm)
    
  //     const state0 = buildState({ code, bitmask, registers: regs });
  //     const state1 = executeSingleStep(state0);
      
  //     expect(state1.pc).toBe(nextPc(state0));
  //   });
  // });

  // describe("A.5.9 Two Registers instructions", () => {

  //   it("100 move_reg moves data from rA to rD", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.move_reg, 
  //       0x12, // rA = 1 register , rD = 2 source  -- for dynamic registers
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 42n; // source register
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);

  //     console.log(s1.registers);
  
  //     expect(s1.registers[2]).toBe(42n);
  //   });
  
  //   it("101 sbrk allocates heap memory correctly", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.sbrk, 
  //       0x01, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[0] = 64n; // requested size
  
  //     const heapStart = 0x1000;
  
  //     const s0 = buildState({
  //       code,
  //       bitmask,
  //       registers: regs,
  //       heapStart,
  //       heapPointer: heapStart,
  //     });
  
  //     const s1 = executeSingleStep(s0);

  //     console.log(s1);
  
  //     expect(s1.registers[1]).toBe(BigInt(heapStart));
  //     expect(s1.context!.heapPointer).toBe(heapStart + 64);
  //   });
  
  //   it("102 count_set_bits_64 counts set bits correctly", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.count_set_bits_64, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0b1011n;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(3n);
  //   });
  
  //   it("103 count_set_bits_32 counts set bits in lower 32 bits", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.count_set_bits_32, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFF000F_FFFFFFFFn;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(32n);
  //   });

  //   it("104 leading_zero_bits_64 correctly calculates leading zero bits", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.leading_zero_bits_64, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x0000FFFF_FFFFFFFFn; // 16 leading zeros in 64-bit
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(16n);
  //   });

  //   it("105 leading_zero_bits_32 correctly calculates leading zero bits", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.leading_zero_bits_32, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x0000FFFFn; // 16 leading zeros in 32-bit
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(16n);
  //   });

  //   it("106 trailing_zero_bits_64 correctly calculates leading zero bits", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.trailing_zero_bits_64, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFF0000_00000000n; // 16 leading zeros in 64-bit
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     console.log(s1);
  //     expect(s1.registers[2]).toBe(48n);
  //   });

  //   it("107 trailing_zero_bits_32 correctly calculates leading zero bits", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.trailing_zero_bits_32, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFF0000n; // 16 leading zeros in 64-bit
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     console.log(s1);
  //     expect(s1.registers[2]).toBe(16n);
  //   });
  
  //   it("108 sign_extend_8 correctly sign-extends 8-bit value", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.sign_extend_8, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFn;  // -1 in 8-bit signed
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     console.log(s1);
  
  //     expect(s1.registers[2]).toBe(-1n);
  //   });

  //   it("109 sign_extend_16 correctly sign-extends 16-bit value", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.sign_extend_16, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFFn;  // -1 in 16-bit signed
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(-1n);
  //   });

  //   it("110 zero_extend_16 correctly zero-extends 16-bit value", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.zero_extend_16, 
  //       0x12, 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFFn;  // 65535 in 16-bit unsigned
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(65535n);
  //   }
  // );
  
  //   it("111 reverse_bytes reverses byte order correctly", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.reverse_bytes, 
  //       0x12, 
  //       Opcodes.trap);
  //     const bitmask = Uint8Array.of(0b00000101);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x1122334455667788n;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(0x8877665544332211n);
  //   });
  // });

  describe("A.5.10 Two Registers & One Immediate instructions (120-123)", () => {
    
    const BASE = 0x30000;   // r1 will hold this address
    
    function wrap(code: Uint8Array, bitmask: Uint8Array): Uint8Array {
      return buildBlob({
        meta:        Uint8Array.of(0),
        jumpTbl:     Uint8Array.of(0),
        z:           1,
        instr:       code,
        jumpEntries: [Uint8Array.of(0)],
        bitmaskBits: bitmask,
      });
    }
  
    const PROG = Uint8Array.of(
      Opcodes.load_imm, 0x00,    0xAA, 0x00, 0x00, 0x00, // 0xAA is 0b10101010 which in decimal is 170
      Opcodes.load_imm, 0x01,    0x00, 0x00, 0x03, 0x00,
      Opcodes.store_ind_u8, 0x10, 0x05,
      Opcodes.trap
    );

    const MASK = Uint8Array.of(0b01000001, 0b10010000); 

    it("opcode 120 - writes one byte at r1 + imm and hits the trap", () => {

      // Heap is page 3 (0x30000‥0x37FFF) and is RW
      const final = runBlob(wrap(PROG, MASK), 
        500, // gas 
        {
          memSize  : 0x40000, // 256 KiB -> 4 pages
          heapStart: 0x30000, // page 3
          heapEnd  : 0x38000,
        });

      expect(final.memory[0x30000 + 5]).toBe(0xAA);
      expect(final.exit?.type).toBe(ExitReasonType.Panic);
    });

    it("opcode 121 - stores two bytes little-endian", () => {

      // value 0xBEEF, immediate offset +2
      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,   0xEF, 0xBE, 0x00, 0x00,   // r0 = 0xBEEF
        Opcodes.load_imm , 0x01,   0x00, 0x00, 0x03, 0x00,   // r1 = BASE
        Opcodes.store_ind_u16, 0x10, 0x02,                   // r0 ->[r1+2]
        Opcodes.trap
      );

      const mask = Uint8Array.of(0b01000001, 0b10010000);

      const vm = runBlob(wrap(code, mask), 500, MEM_OPTS);

      expect(vm.memory[BASE + 2]).toBe(0xEF);
      expect(vm.memory[BASE + 3]).toBe(0xBE);
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);
    });

    it("opcode 122 - stores four bytes little-endian", () => {

      const code = Uint8Array.of(
        Opcodes.load_imm , 0x00,       0xEF, 0xBE, 0xAD, 0xDE,   // r0 = 0xDEADBEEF
        Opcodes.load_imm , 0x01,       0x00, 0x00, 0x03, 0x00,   // r1 = BASE
        Opcodes.store_ind_u32, 0x10, 0x00,                             // r0->[r1+0]
        Opcodes.trap
      );
      const mask = Uint8Array.of(0b01000001, 0b10010000);

      const vm = runBlob(wrap(code, mask), 500, MEM_OPTS);

      expect(vm.memory.subarray(BASE, BASE + 4)).toEqual(
        Uint8Array.of(0xEF, 0xBE, 0xAD, 0xDE)
      );
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);
    });

    it("opcode 123 - stores eight bytes little-endian", () => {

      const code = Uint8Array.of(
        Opcodes.load_imm_64, 0x00,
          0x88, 0x77, 0x66, 0x55, 0x44, 0x33, 0x22, 0x11,      // r0 =  0x1122334455667788
        Opcodes.load_imm, 0x01,    0x00, 0x00, 0x03, 0x00,        // r1 =  BASE     (starts at byte 10)
        Opcodes.store_ind_u64, 0x10, 0x08,                     // r0 -> [r1+8]   (byte 16)
        Opcodes.trap
      );

      const mask = Uint8Array.of(0b00000001, 0b00000100, 0b00001001); 

      const vm = runBlob(wrap(code, mask), 700, MEM_OPTS);

      expect(vm.memory.slice(BASE + 8, BASE + 16)).toEqual(
        Uint8Array.of(0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11)
      );
      expect(vm.exit?.type).toBe(ExitReasonType.Panic);
    });
  });

  // describe("A.5.10 Two Registers & One Immediate instructions (124-130)", () => {
  


  //     const BASE = 0x30000;   // r1 will hold this
    
  //     // helper -> wrap raw code into a minimal, valid blob
  //     const wrap = (code: Uint8Array, mask: Uint8Array) =>
  //       buildBlob({
  //         meta:        Uint8Array.of(0),   // empty meta
  //         jumpTbl:     Uint8Array.of(0),   // no jump table
  //         z:           1,
  //         instr:       code,
  //         jumpEntries: [Uint8Array.of(0)],
  //         bitmaskBits: mask,
  //       });

  //     it("124 load_ind_u8 loads the unsigned byte at (r1 + imm) into r2", () => {
  //             const PROG = Uint8Array.of(
  //               Opcodes.load_imm , 0x00,   0xAB, 0x00, 0x00, 0x00,
  //               Opcodes.load_imm , 0x01,   0x00, 0x00, 0x03, 0x00,
  //               Opcodes.store_ind_u8, 0x10, 0x04,                               // rA=0 rB=1 imm=4
  //               Opcodes.load_ind_u8 , 0x12, 0x04,                               // rA=2 rB=1 imm=4  (0x12 = rB<<4 | rA)
  //               Opcodes.trap
  //             );
    
  //       const MASK = Uint8Array.of(
  //         0b0100_0001,  // bits 0,6
  //         0b1001_0000,  // bits 12,15
  //         0b0000_0100   // no bits set for 18
  //       );
    
  //       // dump(PROG, Array.from(BITMASK).map(bit => !!bit))
        
  //       const vm = runBlob(
  //         wrap(PROG, MASK), 
  //         400, //gas
  //         MEM_OPTS
  //       );
  //       console.log(vm);
    
  //       // result
  //       expect(vm.registers[2]).toBe(0xABn);                    // r2 got the byte
  //       expect(vm.memory[BASE + 4]).toBe(0xAB);                 // byte really written
  //       expect(vm.exit?.type).toBe(ExitReasonType.Panic);       
  //     });
    
  //     it("125  load_ind_i8  -> signed 8-bit", () => {
  //       const CODE = Uint8Array.of(
  //         Opcodes.load_imm, 0x00,   0xFF,0,0,0,                       // r0 = 0xFF (-1)
  //         Opcodes.load_imm, 0x01,   0x00,0x00,0x03,0x00,              // r1 = BASE
  //         Opcodes.store_ind_u8, 0x10, 0x02,                         // *(r1+2) = 0xFF
  //         Opcodes.load_ind_i8 , 0x12, 0x02,                         // r2 = *(r1+2)
  //         Opcodes.trap
  //       );
  //       const MASK = Uint8Array.of(0b0100_0001, 0b1001_0000, 0b0000_0100); 
    
  //       const vm = runBlob(wrap(CODE, MASK), 400, MEM_OPTS);
  //       expect(vm.registers[2]).toBe(-1n);
  //       expect(vm.exit?.type).toBe(ExitReasonType.Panic);
  //     });
      
  //     it("126  load_ind_u16 -> unsigned 16-bit", () => {
  //       const CODE = Uint8Array.of(
  //         Opcodes.load_imm, 0x00,   0xEF,0xBE,0x00,0x00,              // r0 = 0xBEEF
  //         Opcodes.load_imm, 0x01,   0x00,0x00,0x03,0x00,              // r1 = BASE
  //         Opcodes.store_ind_u16, 0x10, 0x00,                        // *(r1+0) = r0
  //         Opcodes.load_ind_u16 , 0x12, 0x00,                        // r2 = *(r1+0)
  //         Opcodes.trap
  //       );
  //       const MASK = Uint8Array.of(0b0100_0001, 0b1001_0000, 0b0000_0100); 
    
  //       const vm = runBlob(wrap(CODE, MASK), 400, MEM_OPTS);
  //       expect(vm.registers[2]).toBe(0xBEEFn);
  //     });
    
  //     it("127  load_ind_i16 -> signed 16-bit", () => {
  //       const CODE = Uint8Array.of(
  //         Opcodes.load_imm, 0x00,   0x00,0x80,0x00,0x00,              // r0 = 0x8000 (-32768)
  //         Opcodes.load_imm, 0x01,   0x00,0x00,0x03,0x00,              // r1 = BASE
  //         Opcodes.store_ind_u16, 0x10, 0x04,                        // *(r1+4) = r0
  //         Opcodes.load_ind_i16 , 0x12, 0x04,                        // r2 = *(r1+4)
  //         Opcodes.trap
  //       );
  //       const MASK = Uint8Array.of(0b0100_0001, 0b1001_0000, 0b0000_0100); 
    
  //       const vm = runBlob(wrap(CODE, MASK), 400, MEM_OPTS);
  //       expect(vm.registers[2]).toBe(-32768n);
  //     });
    
  //     it("128  load_ind_u32 -> unsigned 32-bit", () => {
  //       const CODE = Uint8Array.of(
  //         Opcodes.load_imm, 0x00,   0x78,0x56,0x34,0x12,              // r0 = 0x12345678
  //         Opcodes.load_imm, 0x01,   0x00,0x00,0x03,0x00,              // r1 = BASE
  //         Opcodes.store_ind_u32, 0x10, 0x08,                        // *(r1+8) = r0
  //         Opcodes.load_ind_u32 , 0x12, 0x08,                        // r2 = *(r1+8)
  //         Opcodes.trap
  //       );
  //       const MASK = Uint8Array.of(0b0100_0001, 0b1001_0000, 0b0000_0100); 
    
  //       const vm = runBlob(wrap(CODE, MASK), 400, MEM_OPTS);
  //       expect(vm.registers[2]).toBe(0x12345678n);
  //     });
    
  //     it("129  load_ind_i32 -> signed 32-bit", () => {
  //       const CODE = Uint8Array.of(
  //         Opcodes.load_imm, 0x00,   0x00,0x00,0x00,0x80,              // r0 = 0x80000000 (-2 147 483 648)
  //         Opcodes.load_imm, 0x01,   0x00,0x00,0x03,0x00,              // r1 = BASE
  //         Opcodes.store_ind_u32, 0x10, 0x0C,                        // *(r1+12) = r0
  //         Opcodes.load_ind_i32 , 0x12, 0x0C,                        // r2 = *(r1+12)
  //         Opcodes.trap
  //       );
  //       const MASK = Uint8Array.of(0b0100_0001, 0b1001_0000, 0b0000_0100); 
    
  //       const vm = runBlob(wrap(CODE, MASK), 400, MEM_OPTS);
  //       expect(vm.registers[2]).toBe(-2147483648n);
  //     });
    
  //     it("130  load_ind_u64 -> unsigned 64-bit", () => {
        
  //       const CODE = Uint8Array.of(
  //         Opcodes.load_imm_64, 0x00,
  //           0xEF,0xCD,0xAB,0x89,0x67,0x45,0x23,0x01,           // r0 = 0x0123456789ABCDEF 
  //         Opcodes.load_imm,     0x01,   0x00,0x00,0x03,0x00,        // r1 = BASE
  //         Opcodes.store_ind_u64,0x10, 0x10,                   // *(r1+16) = r0
  //         Opcodes.load_ind_u64 ,0x12, 0x10,                   // r2 = *(r1+16)
  //         Opcodes.trap
  //       );

  //       const MASK = Uint8Array.of(0b00000001, 0b00000100, 0b01001001);
    
  //       const vm = runBlob(wrap(CODE, MASK), 800, MEM_OPTS);
  //       expect(vm.registers[2]).toBe(0x0123456789ABCDEFn);
  //       expect(vm.exit?.type).toBe(ExitReasonType.Panic);
  //     });
  // });
    
  // describe("A.5.10 Two Registers & One Immediate Arithmetic Instructions", () => {
  //   const makeInstruction = (opcode: number, rA: number, rB: number, imm: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, imm, Opcodes.trap);
  
  //   it("131 add_imm_32 correctly adds immediate to register (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.add_imm_32, 
  //       1, // rA destination register
  //       2,// rB is source of 2
  //       10); // imm = 10
  //     const bitmask = Uint8Array.of(0b00001001);
      
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 20n;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(30n); // 20 + 10 = 30
  //   });
  
  //   it("132 and_imm correctly performs bitwise AND", () => {
  //     const code = makeInstruction(Opcodes.and_imm, 1, 2, 0x0F); // immediate value of 0x0F
  //     const bitmask = Uint8Array.of(0b00001001);
  
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xFFn; // value in register 2 which is bitwise & masked with imm of 0x0F
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(0x0Fn); // 0b11111111 & 0b00001111 = 0b00001111
  //   });
  
  //   it("133 xor_imm correctly performs bitwise XOR", () => {
  //     const code = makeInstruction(Opcodes.xor_imm, 1, 2, 0x0F);
  //     const bitmask = Uint8Array.of(0b00001001);
      
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xF0n;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(0xFFn); // 0b11110000 ^ 0b00001111 = 0b11111111
  //   });
  
  //   it("134 or_imm correctly performs bitwise OR", () => {
  //     const code = makeInstruction(Opcodes.or_imm, 1, 2, 0x0F);
  //     const bitmask = Uint8Array.of(0b00001001);
      
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xF0n;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(0xFFn); // 0b11110000 | 0b00001111 = 0b11111111
  //   });
  
  //   it("135 mul_imm_32 correctly multiplies register by immediate (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.mul_imm_32, 1, 2, 5);
  //     const bitmask = Uint8Array.of(0b00001001);
      
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 6n;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(30n); // 6 * 5 = 30
  //   });
  
  //   // 149–150: 64-bit arithmetic
  
  //   it("149 add_imm_64 correctly adds immediate to register and overflows (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.add_imm_64, 1, 2, 10);
  //     const bitmask = Uint8Array.of(0b00001001);
      
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xFFFFFFFFFFFFFFFAn; // value = large 64-bit value to check overflow handling 
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(4n); // 0xFFFFFFFFFFFFFFFA + 10 = 0x10000000000000004 wraps around to 4
  //   });

  //   it("149 add_imm_64 correctly adds immediate to register and doesnt overflow (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.add_imm_64, 1, 2, 10);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x0000000000000000n; // value = 0
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(10n); // 0 + 10 = 10
  //   }
  //   );
  
  //   it("150 mul_imm_64 correctly multiplies register by immediate (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.mul_imm_64, 1, 2, 3);
  //     const bitmask = Uint8Array.of(0b00001001);
  
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x3000000000000000n;
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(0x9000000000000000n); // 0x3000000000000000 * 3 = 0x9000000000000000
  //   });
  // });

  // describe("A.5.10 Conditional Move Instructions", () => {

  //   const makeInstruction = (opcode: number, rA: number, rB: number, imm: number) =>
  //     Uint8Array.of(opcode, 
  //       (rB << 4) | rA, // rA and rB packed into one byte
  //       imm, 
  //       Opcodes.trap);

  //   it("147 cmov_iz_imm moves immediate if register is zero", () => {
  //     const code = makeInstruction(Opcodes.cmov_iz_imm, 1, 2, 0x2A);
  //     const bitmask = Uint8Array.of(0b00001001);
    
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 123n;  // Destination register initial value (should be overwritten)
  //     regs[2] = 0n;    // Source register is zero (condition true)
    
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
    
  //     expect(s1.registers[1]).toBe(42n); // Condition true: immediate (0x2A = 42 decimal) should overwrite rA (register[1])

  //   });
    
  //   it("147 cmov_iz_imm does NOT move immediate if register is not zero", () => {
  //     const code = makeInstruction(Opcodes.cmov_iz_imm, 1, 2, 0x2A);
  //     const bitmask = Uint8Array.of(0b00001001);
    
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 123n;  // Destination register initial value (should NOT be overwritten)
  //     regs[2] = 1n;    // Source register is not zero (condition false)
    
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
    
  //     expect(s1.registers[1]).toBe(123n); // Condition false: destination register remains unchanged
  //   });
    
  //   it("148 cmov_nz_imm moves immediate if register is NOT zero", () => {
  //     const code = makeInstruction(Opcodes.cmov_nz_imm, 1, 2, 0x2A);
  //     const bitmask = Uint8Array.of(0b00001001);
    
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 456n;  // Destination register initial value (should be overwritten)
  //     regs[2] = 5n;    // Source register is not zero (condition true)
    
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
    
  //     expect(s1.registers[1]).toBe(42n); // Condition true: immediate (0x2A = 42 decimal) overwrites destination register
  //   });
    
  //   it("148 cmov_nz_imm does NOT move immediate if register is zero", () => {
  //     const code = makeInstruction(Opcodes.cmov_nz_imm, 1, 2, 0x2A);
  //     const bitmask = Uint8Array.of(0b00001001);
    
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 456n;  // Destination register initial value (should NOT be overwritten)
  //     regs[2] = 0n;    // Source register is zero (condition false)
    
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
      
  //     expect(s1.registers[1]).toBe(456n); // Condition false: destination register remains unchanged
  //   });
  // });


  // describe("A.5.10 Two Registers & One Immediate Set Comparison Instructions", () => {

  //   const makeInstruction = (opcode: number, rA: number, rB: number, imm: number) =>
  //     Uint8Array.of(
  //       opcode,
  //       (rB << 4) | rA,
  //       imm & 0xFF,       // Low byte
  //       (imm >> 8) & 0xFF, // High byte
  //       Opcodes.trap
  //     );

  //   it("136 set_lt_u_imm correctly compares unsigned values (less than)", () => {
  //     const code = makeInstruction(Opcodes.set_lt_u_imm, 1, 2, 5);

  //     const bitmask = Uint8Array.of(0b00001001);
  
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 3n; // 3 < 5 => true (1)
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);

  //     console.log(s1);
  
  //     expect(s1.registers[1]).toBe(1n);
  //   });

  //   // edge case
  //   it("136 set_lt_u_imm returns false correctly", () => {
  //     const code = Uint8Array.of(Opcodes.set_lt_u_imm, 0x21, 3, Opcodes.trap);
  //     const bitmask = Uint8Array.of(0b00001001);
  
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 5n; // 5 < 3 => false (0)
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[2]).toBe(0n);
  //   });
  
  
  //   it("137 set_lt_s_imm correctly compares signed values (less than)", () => {
  //     const code = makeInstruction(Opcodes.set_lt_s_imm, 1, 2, -1); // -1 signed
  //     const bitmask = Uint8Array.of(0b00001001);
  
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -10n; // -10 < -1 => true (1)
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(1n);
  //   });
  
  //   it("142 set_gt_u_imm correctly compares unsigned values (greater than)", () => {
  //     const code = makeInstruction(Opcodes.set_gt_u_imm, 1, 2, 5);
  //     const bitmask = Uint8Array.of(0b00001001);
  
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 10n; // 10 > 5 => true (1)
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(1n);
  //   });

  //   describe("Opcode 143 (set_gt_s_imm)", () => {

  //     it("143 set_gt_s_imm correctly compares signed values (greater than)", () => {
  //       const code = makeInstruction(
  //         Opcodes.set_gt_s_imm, 
  //         1, 2, 
  //         0xFFFE // -2 signed, 0b11111111 11111110
  //       ); 
  //       const bitmask = Uint8Array.of(0b00001001);
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = 0n; // 0 > -2 => true (1)
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
  //       console.log(s1);
    
  //       expect(s1.registers[1]).toBe(1n);
  //     });
    
  
  //     const bitmask = Uint8Array.of(0b00001001);
    
  //     test("0 > -2 should be true (1)", () => {
  //       const code = makeInstruction(Opcodes.set_gt_s_imm, 1, 2, 0xFFFE); // -2 signed
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = 0n; // source = 0
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[1]).toBe(1n);
  //     });
    
  //     test("-3 > -2 should be false (0)", () => {
  //       const code = makeInstruction(Opcodes.set_gt_s_imm, 1, 2, 0xFFFE); // -2 signed
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = -3n; // source = -3
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[1]).toBe(0n);
  //     });
    
  //     test("2 > 2 should be false (0)", () => {
  //       const code = makeInstruction(Opcodes.set_gt_s_imm, 1, 2, 2);
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = 2n; // source = 2
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[1]).toBe(0n);
  //     });
    
  //     test("5 > -5 should be true (1)", () => {
  //       const code = makeInstruction(Opcodes.set_gt_s_imm, 1, 2, 0xFFFB); // -5 signed
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = 5n; // source = 5
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[1]).toBe(1n);
  //     });
    
  //     test("-1 > -1 should be false (0)", () => {
  //       const code = makeInstruction(Opcodes.set_gt_s_imm, 1, 2, 0xFFFF); // -1 signed
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = -1n; // source = -1
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[1]).toBe(0n);
  //     });
    
  //     test("127 > -128 should be true (1)", () => {
  //       const code = makeInstruction(Opcodes.set_gt_s_imm, 1, 2, 0xFF80); // -128 signed (edge case)
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = 127n; // max positive int8
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[1]).toBe(1n);
  //     });
    
  //     test("-128 > 127 should be false (0)", () => {
  //       const code = makeInstruction(Opcodes.set_gt_s_imm, 1, 2, 127); // 127 positive
    
  //       const regs = Array(13).fill(0n);
  //       regs[2] = -128n; // min negative int8
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[1]).toBe(0n);
  //     });
    
  //     // edge case
  //     it("143 set_gt_s_imm returns false correctly", () => {
  //       const code = Uint8Array.of(Opcodes.set_gt_s_imm, 0x21, 
  //         1,
  //         Opcodes.trap);
  //       const bitmask = Uint8Array.of(0b00001001);
    
  //       const regs = Array(13).fill(0n);
  //       regs[1] = -1n; // -1 > 1 => false (0)
    
  //       const s0 = buildState({ code, bitmask, registers: regs });
  //       const s1 = executeSingleStep(s0);
    
  //       expect(s1.registers[2]).toBe(0n);
  //     });
  //   });
  // });

  // describe("A.5.10 Shift and Arithmetic Instructions (138–141)", () => {
  //   const makeInstruction = (opcode: number, rA: number, rB: number, imm: number) =>
  //     Uint8Array.of(
  //       opcode,
  //       (rB << 4) | rA,
  //       imm & 0xFF,
  //       (imm >> 8) & 0xFF,
  //       Opcodes.trap
  //     );
  
  //   it("138 shlo_l_imm_32 correctly shifts left logically (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_l_imm_32, 1, 2, 2); // shift left by 2
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x000000FFn; // 0x000000FF << 2 = 0b00000000 00000000 00000000 11111111 << 2 = 0b 00000000 00000000 00000000 11111100 => 0x000003FC
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(0x000003FCn);
  //   });
  
  //   it("139 shlo_r_imm_32 correctly shifts right logically (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_r_imm_32, 1, 2, 4); // shift right by 4
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x000000F0n; // 0xF0 >> 4 = 0x0F
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(0x0000000Fn);
  //   });
  
  //   it("140 shar_r_imm_32 correctly shifts right arithmetically (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.shar_r_imm_32, 1, 2, 3); // arithmetic shift right by 3
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xFFFFFFF8n; // (-8 signed 32-bit) >> 3 = -1 signed 32-bit (0xFFFFFFFFn) 
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(-1n); // -1 in 32-bit signed
  //     expect(s1.registers[1] & 0xFFFFFFFFn).toBe(0xFFFFFFFFn); // same as above but unsigned interpretation 

  //   });
  
  //   it("141 neg_add_imm_32 correctly computes negative add immediate (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.neg_add_imm_32, 1, 2, 5); // compute (5 + 2^32 - rB)
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 3n; // Result: (5 + 2^32 - 3) = 2 (mod 2^32)
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     console.log(s1);
  //     expect(s1.registers[1]).toBe(2n);
  //   });
  
  //   // Edge case for 141
  //   it("141 neg_add_imm_32 correctly wraps around (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.neg_add_imm_32, 1, 2, 1); 
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0n; // Result: (1 + 2^32 - 0) mod 2^32 = 1
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(1n);
  //   });
  // });

  // describe("Shift Instructions 144–146", () => {
  //   const makeInstruction = (opcode: number, rA: number, rB: number, imm: number) =>
  //     Uint8Array.of(
  //       opcode,
  //       (rB << 4) | rA,
  //       imm & 0xFF,
  //       (imm >> 8) & 0xFF,
  //       Opcodes.trap
  //     );
  
  //   it("144 shlo_l_imm_alt_32 shifts immediate left by register (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_l_imm_alt_32, 1, 2, 0x0001); // 1 << reg[2]
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 4n; // shift by 4
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);

  //     console.log(s1);
  
  //     expect(s1.registers[1]).toBe(16n); // 1 << 4 = 16
  //   });
  
  //   it("145 shlo_r_imm_alt_32 shifts immediate right logically by register (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_r_imm_alt_32, 1, 2, 0x0010); // 16 >> reg[2]
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 2n; // shift by 2
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(4n); // 16 >> 2 = 4
  //   });
  
  //   it("146 shar_r_imm_alt_32 shifts immediate right arithmetically by register (32-bit signed)", () => {
  //     const code = makeInstruction(Opcodes.shar_r_imm_alt_32, 1, 2, 0xFFF8); // -8 >> reg[2]
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 2n; // shift by 2
  
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  
  //     expect(s1.registers[1]).toBe(-2n); // arithmetic shift preserves sign, -8 >> 2 = -2
  //   });
  // });

  // describe("Instruction Handlers (151-161)", () => {

  //   const makeInstruction = (opcode: number, rA: number, rB: number, imm: number) =>
  //     Uint8Array.of(
  //       opcode,
  //       (rB << 4) | rA,
  //       imm & 0xFF,       // Low byte
  //       (imm >> 8) & 0xFF, // High byte
  //       Opcodes.trap
  //     );
  
  //   it("151 shlo_l_imm_64 shifts left logically (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_l_imm_64, 1, 2, 4);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 1n; // 1 << 4 = 16
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(16n);
  //   });

  //   it("152 shlo_r_imm_64 shifts right logically (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_r_imm_64, 1, 2, 3);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xF000000000000000n; // Shift large value right by 3 bits
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(0x1E00000000000000n); // Logical right shift fills with zeros
  //   });
  
  //   it("153 shar_r_imm_64 shifts right arithmetically (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.shar_r_imm_64, 1, 2, 3);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -8n; // -8 signed >> 3 = -1
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(-1n);
  //   });
  
  //   it("154 neg_add_imm_64 computes (imm + 2^64 - rB)", () => {
  //     const code = makeInstruction(Opcodes.neg_add_imm_64, 1, 2, 10);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 5n; // 10 + 2^64 - 5 mod 2^64 = 5
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(5n);
  //   });

  //     // 155 shlo_l_imm_alt_64
  //   it("155 shlo_l_imm_alt_64 shifts immediate left logically by register (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_l_imm_alt_64, 1, 2, 0x0002);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 3n; // shift immediate (2) left by 3 bits
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(16n); // 2 << 3 = 16
  //   });

  //   it("156 shlo_r_imm_alt_64 shifts immediate right logically by register (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_r_imm_alt_64, 1, 2, 0x0020);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 4n; // shift immediate (32) right by 4 bits
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(2n); // 32 >> 4 = 2
  //   });

  //   it("157 shar_r_imm_alt_64 shifts immediate right arithmetically by register (64-bit signed)", () => {
  //     const code = makeInstruction(Opcodes.shar_r_imm_alt_64, 1, 2, 0xFFF0); // -16 signed (0xFFF0)
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 2n; // shift right by 2 bits
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(-4n); // -16 >> 2 = -4, arithmetic shift preserves sign
  //   });
  
  //   it("158 rot_r_64_imm rotates right (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.rot_r_64_imm, 1, 2, 4);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x1234567890ABCDEFn;
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(0xF1234567890ABCDEn);
  //   });

  //   it("159 rot_r_64_imm_alt rotates immediate right by register (64-bit)", () => {
  //     const code = makeInstruction(Opcodes.rot_r_64_imm_alt, 1, 2, 0x1234);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 4n; // rotate right by 4 bits
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     // 0x00001234 rotates right 4 bits = 0x40000123_40000000
  //     // however we should rotate within 64-bits, here the actual correct rotation is...
  //     expect(s1.registers[1]).toBe(0x4000000000000123n); // Correct 64-bit rotation
  //   });
  
  //   it("160 rot_r_32_imm rotates right (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.rot_r_32_imm, 1, 2, 8);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x12345678n;
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(0x78123456n);
  //   });
  
  //   it("161 rot_r_32_imm_alt rotates immediate right by register (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.rot_r_32_imm_alt, 1, 2, 0x1234);
  //     const bitmask = Uint8Array.of(0b00001001);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 8n; // shift by 8
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.registers[1]).toBe(0x34000012n);
  //   });
  // });
  
  // describe("Branching Instructions (170–175)", () => {
  //   const bitmask = Uint8Array.of(0b00001001);
  
  //   // Ensuring offset aligns correctly with basic block
  //   it("170 branch_eq branches if registers are equal", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_eq, 0x21, 
  //       5,    // Offset = 5 (points directly to the trap instruction)
  //       0, 0, // padding 
  //       Opcodes.trap
  //     );
  //     const bitmask = Uint8Array.of(0b00100001);

  //     const regs = Array(13).fill(0n);
  //     regs[1] = 10n; regs[2] = 10n; // Equal
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);

  //     expect(s1.pc).toBe(5);
  //   });
  
  //   it("170 branch_eq doesn't branch if registers differ", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_eq, 0x21, 
  //       3,  
  //       Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 10n; regs[2] = 20n; // Not equal
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.pc).toBe(nextPc(s0)); // should proceed normally
  //   });
  
  //   it("171 branch_ne branches if registers differ", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_ne, 0x21, 6,
  //       0, 0, Opcodes.trap, // padding
  //       Opcodes.trap // next instruction
  //     );
  //     const bitmask = Uint8Array.of(0b01000001);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 5n; regs[2] = 3n; // wA != wB therefore branches
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     console.log(s1);
  //     expect(s1.pc).toBe(6); // exactly at second trap (valid)
  //   });
  
  //   // Likewise for all other failing tests:
  //   it("172 branch_lt_u branches if rA < rB (unsigned)", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_lt_u, 0x21, 3, 0, Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 2n; regs[2] = 10n;
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.pc).toBe(3); // exactly at the trap
  //   });
  
  //   it("173 branch_lt_s branches if rA < rB (signed)", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_lt_s, 0x21, 3, 0, Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -20n; regs[2] = -10n;
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.pc).toBe(3); // aligned correctly
  //   });
  
  //   it("174 branch_ge_u branches if rA >= rB (unsigned)", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_ge_u, 0x21, 3, 0, Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 20n; regs[2] = 10n;
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.pc).toBe(3); 
  //   });
  
  //   it("175 branch_ge_s branches if rA >= rB (signed)", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_ge_s, 0x21, 3, 0, Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -5n; regs[2] = -10n;
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.pc).toBe(3);
  //   });
  
  //   it("175 branch_ge_s doesn't branch if rA < rB (signed)", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.branch_ge_s, 0x21, 3, 0, Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -15n; regs[2] = -10n;
  //     const s0 = buildState({ code, bitmask, registers: regs });
  //     const s1 = executeSingleStep(s0);
  //     expect(s1.pc).toBe(nextPc(s0)); // no branch
  //   });
  // });

  describe("180 load_imm_jump_ind", () => {
    it("loads vX into rA and jumps indirectly via jump table", () => {
  
      const jumpTbl = Uint8Array.of(0x00, 0x01);
  
      const jumpEntries = [
        Uint8Array.of(0x03, 0, 0, 0), // entry 0 => pc 3
        Uint8Array.of(0x0A, 0, 0, 0)  // entry 1 => pc 10
      ];
  
      const instr = Uint8Array.of(
        Opcodes.load_imm_jump_ind,
        0x21,                   // rA=1 (low nibble), rB=2 (high nibble)
        0x04,                   // lX = 4 byte immediate
        0x10, 0x00, 0x00, 0x00, // vX = 16
        0x02, 0x00, 0x00, 0x00, // vY = 2
        Opcodes.trap            // placed at pc 10
      );
  
      const bitmaskBits = Uint8Array.of(0b00000001, 0b00000100); // 2 bytes because 
  
      const blob = buildBlob({
        meta:  Uint8Array.of(0x00),
        jumpTbl,  
        z: 4,
        instr,
        jumpEntries,
        bitmaskBits
      });
  
      const regs = Array(13).fill(0n);
      regs[2] = 2n;   // wrB = 2 (1 won't work because it will not pass djump, must result to an even number.)
  
      const s0 = buildState({ blob, registers: regs });
  
      const s1 = executeSingleStep(s0);
      console.log(s1);
  
      expect(s1.registers[1]).toBe(16n);  // vX correctly loaded into rA
      expect(s1.pc).toBe(10);          // jumped to entry 1 (pc 10)
      expect(s1.exit!.type).toBe(ExitReasonType.Continue);
    });
  });


  // describe("A.5.13 Three-Register – 32-bit arithmetic (190-196)", () => {
  //   /** helper to build the 3-reg instruction blob */
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(
  //       opcode, 
  //       (rB << 4) | rA, 
  //       rD, 
  //       Opcodes.trap);
  
  //   const bitmask = Uint8Array.of(0b00010001); // opcode at 0, trap at 3
  
  //   test("190 add_32 wraps modulo 2^32", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.add_32,   // 190
  //       0x21,             // rB=2, rA=1
  //       0x03,             // rD = 3
  //       Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFF_FFFFn; regs[2] = 2n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     console.log(s1);
  //     expect(s1.registers[3]).toBe(1n);        // 0x1_0000_0001 -> 1
  //   });
  
  //   test("193 div_u_32 division-by-zero gives all-ones", () => {
  //     const code = makeInstruction(Opcodes.div_u_32, 4, 1,2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 123n; regs[2] = 0n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[4]).toBe(0xFFFF_FFFFn);
  //   });
  
  //   test("194 div_s_32 handles −2^31 / −1 saturation", () => {
  //     const code = makeInstruction(Opcodes.div_s_32, 5, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = (-0x8000_0000n); regs[2] = -1n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[5]).toBe(0x8000_0000n); // unchanged & mod-32-masked
  //   });
  
  //   test("196 rem_s_32 returns 0 on same corner case", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.rem_s_32,   // 196
  //       0x21,               // rB=2, rA=1
  //       0x06,               // rD = 6
  //       Opcodes.trap        // trap instruction
  //     )
  //     const regs = Array(13).fill(0n);
  //     regs[1] = (-0x8000_0000n); regs[2] = -1n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[6]).toBe(0n);
  //   });
  // });

  // describe("A.5.13 Three-Register – Arithmetic (194-199)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);
  
  //   const bitmask = Uint8Array.of(0b0001001);
  
  //   test("194 div_s_32 normal signed division", () => {
  //     const code = makeInstruction(Opcodes.div_s_32, 3, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = (-10n); regs[2] = 2n; // -10 / 2 = -5
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(0xFFFFFFFBn); // -5 in two's complement
  //   });
  
  //   test("195 rem_u_32 modulo with zero divisor returns dividend", () => {
  //     const code = makeInstruction(Opcodes.rem_u_32, 4, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 1234n; regs[2] = 0n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[4]).toBe(1234n);
  //   });
  
  //   test("195 rem_u_32 normal modulo", () => {
  //     const code = makeInstruction(Opcodes.rem_u_32, 4, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 100n; regs[2] = 30n; // 100 mod 30 = 10
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[4]).toBe(10n);
  //   });
  
  //   test("196 rem_s_32 normal signed modulo", () => {
  //     const code = makeInstruction(Opcodes.rem_s_32, 5, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -10n; regs[2] = 3n; // -10 mod 3 = -1
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[5]).toBe(0xFFFFFFFFn); // -1 signed as 32-bit
  //   });
  
  //   test("197 shlo_l_32 logical shift left (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_l_32, 6, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x0000_0001n; regs[2] = 4n; // 1 << 4 = 16
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[6]).toBe(16n);
  //   });
  
  //   test("198 shlo_r_32 logical shift right (32-bit)", () => {
  //     const code = makeInstruction(Opcodes.shlo_r_32, 7, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x8000_0000n; regs[2] = 4n; // 0x8000_0000 >> 4 = 0x0800_0000
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[7]).toBe(0x08000000n);
  //   });
  
  //   test("199 shar_r_32 arithmetic shift right (signed)", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.shar_r_32, 
  //       0x21, 
  //       0x08, 
  //       Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -16n; regs[2] = 2n; // arithmetic shift of -16 by 2 = -4
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     console.log(s1);
  //     expect(s1.registers[8]).toBe(0xFFFFFFFCn); // -4 in two's complement
  //   });
  // });


  // describe("A.5.13 Three-Register – 64-bit arithmetic (200-206)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);
  
  //   const bitmask = Uint8Array.of(0b00010001);
  
  //   test("200 add_64 correctly handles overflow", () => {
  //     const code = makeInstruction(Opcodes.add_64, 3, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFFFFFFFFFFFFFFn; regs[2] = 1n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(0n);
  //   });
  
  //   test("201 sub_64 correctly handles underflow", () => {
  //     const code = makeInstruction(Opcodes.sub_64, 4, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0n; regs[2] = 1n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[4]).toBe(0xFFFFFFFFFFFFFFFFn);
  //   });
  
  //   test("202 mul_64 multiplication wraps modulo 2^64", () => {
  //     const code = makeInstruction(Opcodes.mul_64, 5, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFF_FFFFn; regs[2] = 0xFFFF_FFFFn; // multiplication overflows 32-bit
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[5]).toBe(0xFFFFFFFE00000001n);
  //   });
  
  //   test("203 div_u_64 division-by-zero returns all-ones", () => {
  //     const code = makeInstruction(Opcodes.div_u_64, 6, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 123456789n; regs[2] = 0n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[6]).toBe(0xFFFFFFFFFFFFFFFFn);
  //   });
  
  //   test("204 div_s_64 correctly handles edge -2^63 / -1", () => {
  //     const code = makeInstruction(Opcodes.div_s_64, 7, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -0x8000000000000000n; regs[2] = -1n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[7]).toBe(-0x8000000000000000n);
  //   });
  
  //   test("205 rem_u_64 modulo by zero returns dividend", () => {
  //     const code = makeInstruction(Opcodes.rem_u_64, 8, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 987654321n; regs[2] = 0n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[8]).toBe(987654321n);
  //   });
  
  //   test("206 rem_s_64 correctly handles edge case -2^63 mod -1", () => {
  //     const code = makeInstruction(Opcodes.rem_s_64, 9, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -0x8000000000000000n; regs[2] = -1n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[9]).toBe(0n);
  //   });
  // });
  

  // describe("A.5.13 Three-Register – Bitwise & Shift Instructions (207-209)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);
  
  //   const bitmask = Uint8Array.of(0b00010001);
  
  //   test("207 shlo_l_64 shifts left correctly modulo 64", () => {
  //     const code = makeInstruction(Opcodes.shlo_l_64, 3, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x1n; regs[2] = 4n; // 1 << 4 = 16
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(16n);
  //   });
  
  //   test("208 shlo_r_64 shifts right logically", () => {
  //     const code = makeInstruction(Opcodes.shlo_r_64, 4, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0x10n; regs[2] = 2n; // 16 >> 2 = 4
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[4]).toBe(4n);
  //   });
  
  //   test("209 shar_r_64 shifts right arithmetically preserving sign", () => {
  //     const code = makeInstruction(Opcodes.shar_r_64, 5, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = -0x8n; regs[2] = 2n; // -8 >> 2 = -2 (signed)
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[5]).toBe(-2n);
  //   });
  // });
  
  // describe("A.5.13 Three-Register – Bitwise Logic Instructions (210-212)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);
  
  //   const bitmask = Uint8Array.of(0b00010001);
  
  //   test("210 AND performs bitwise AND correctly", () => {
  //     const code = makeInstruction(Opcodes.and, 3, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xF0F0n; regs[2] = 0x0FF0n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(0x00F0n);
  //   });
  
  //   test("211 XOR performs bitwise XOR correctly", () => {
  //     const code = makeInstruction(Opcodes.xor, 4, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xAAAAn; regs[2] = 0x5555n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[4]).toBe(0xFFFFn);
  //   });
  
  //   test("212 OR performs bitwise OR correctly", () => {
  //     const code = makeInstruction(Opcodes.or, 5, 1, 2);
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xF0F0n; regs[2] = 0x0F0Fn;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[5]).toBe(0xFFFFn);
  //   });
  // });

  // describe("A.5.13 Three-Register – mul_upper (213–215)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);
  
  //   const bitmask = Uint8Array.of(0b00010001);
  
  //   test("213 mul_upper_s_s calculates signed upper bits correctly", () => {
  //     const code = makeInstruction(Opcodes.mul_upper_s_s, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -0x1234_5678_0000_0000n; // signed negative
  //     regs[3] = 0x1000_0000_0000_0000n;  // positive
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     const expected = BigInt.asIntN(64, (BigInt.asIntN(64, regs[2]) * regs[3]) >> 64n);
  //     expect(s1.registers[1]).toBe(expected);
  //   });
  
  //   test("214 mul_upper_u_u calculates unsigned upper bits correctly", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.mul_upper_u_u, 0x21, 0x03, Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[1] = 0xFFFF_FFFF_FFFF_FFFFn; // rA
  //     regs[2] = 0xFFFF_FFFF_FFFF_FFFFn; // rB
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     const product = regs[1] * regs[2];
  //     const expected = (product >> 64n) & 0xFFFF_FFFF_FFFF_FFFFn; // upper 64 bits unsigned
  //     expect(s1.registers[3]).toBe(expected);
  //   });
  
  //   test("215 mul_upper_s_u calculates signed×unsigned upper bits correctly", () => {
  //     const code = makeInstruction(Opcodes.mul_upper_s_u, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -0x8000_0000_0000_0000n; // negative signed
  //     regs[3] = 0x0000_0000_0000_0002n;  // small positive
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     const expected = BigInt.asIntN(64, (BigInt.asIntN(64, regs[2]) * regs[3]) >> 64n);
  //     expect(s1.registers[1]).toBe(expected);
  //   });
  // });
  
  
  // describe("A.5.13 Three-Register Conditional (216–219)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);
  
  //   const bitmask = Uint8Array.of(0b00010001);
  
  //   test("216 set_lt_u correctly compares unsigned values", () => {
  //     const code = makeInstruction(Opcodes.set_lt_u, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 10n; regs[3] = 20n; // 10 < 20 => 1
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(1n);
  //   });
  
  //   test("217 set_lt_s correctly compares signed values", () => {
  //     const code = makeInstruction(Opcodes.set_lt_s, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -10n; regs[3] = 5n; // -10 < 5 => 1
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(1n);
  //   });
  
  //   test("218 cmov_iz moves if rB is zero", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.cmov_iz, 
  //       0x21, // rB=2, rA=1
  //       0x03, // rD = 3
  //       Opcodes.trap // next instruction
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 42n; regs[1] = 0n; regs[3] = 99n; // rB = 0, move rA into rD
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(42n);
  //   });
  
  //   test("218 cmov_iz doesn't move if rB non-zero", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.cmov_iz, 
  //       0x21, // rB=2, rA=1
  //       0x03, // rD = 3
  //       Opcodes.trap // next instruction
  //     );

  //     const regs = Array(13).fill(0n);
  //     regs[2] = 42n; regs[1] = 1n; regs[3] = 99n; // rB = 1, don't move
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(99n);
  //   });
  
  //   test("219 cmov_nz moves if rB non-zero", () => {
  //     const code = Uint8Array.of(
  //           Opcodes.cmov_nz,
  //           0x21, // rB=2, rA=1
  //           0x03, // rD = 3
  //           Opcodes.trap
  //     );
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 77n; regs[1] = 2n; regs[3] = 88n; // rB != 0, move rA into rD
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(77n);
  //   });
  
  //   test("219 cmov_nz doesn't move if rB is zero", () => {
  //     const code = makeInstruction(Opcodes.cmov_nz, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 77n; regs[1] = 0n; regs[3] = 88n; // rB = 0, don't move
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[3]).toBe(88n);
  //   });
  // });

  // describe("A.5.13 Three-Register Rotation Instructions (220–223)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);

  //   const bitmask = Uint8Array.of(0b00010001);

  //   test("220 rot_l_64 rotates left correctly", () => {
  //     const code = makeInstruction(Opcodes.rot_l_64, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x8000000000000001n;
  //     regs[3] = 4n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0x0000000000000018n);
  //   });

  //   test("221 rot_l_32 rotates left correctly", () => {
  //     const code = makeInstruction(Opcodes.rot_l_32, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x80000001n;
  //     regs[3] = 8n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0x00000180n);
  //   });

  //   test("222 rot_r_64 rotates right correctly", () => {
  //     const code = makeInstruction(Opcodes.rot_r_64, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x0000000000000018n;
  //     regs[3] = 4n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0x8000000000000001n);
  //   });

  //   test("223 rot_r_32 rotates right correctly", () => {
  //     const code = makeInstruction(Opcodes.rot_r_32, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x00000180n;
  //     regs[3] = 8n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0x80000001n);
  //   });
  // });

  // describe("A.5.13 Three-Register Bitwise Logic Instructions (224–226)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);

  //   const bitmask = Uint8Array.of(0b00010001);

  //   test("224 and_inv performs bitwise AND with inverted second operand", () => {
  //     const code = makeInstruction(Opcodes.and_inv, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xFFFF_FFFF_0000_0000n;
  //     regs[3] = 0xFFFF_0000_FFFF_0000n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0x0000_FFFF_0000_0000n);
  //   });

  //   test("225 or_inv performs bitwise OR with inverted second operand", () => {
  //     const code = makeInstruction(Opcodes.or_inv, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0x0000_0000_FFFF_FFFFn;
  //     regs[3] = 0xFFFF_0000_0000_FFFFn;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0x0000_FFFF_FFFF_FFFFn);
  //   });

  //   test("226 xnor performs bitwise XNOR correctly", () => {
  //     const code = makeInstruction(Opcodes.xnor, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xF0F0_F0F0_F0F0_F0F0n;
  //     regs[3] = 0x0F0F_0F0F_0F0F_0F0Fn;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0x0000_0000_0000_0000n);
  //   });
  // });

  // describe("A.5.13 Three-Register Min/Max Instructions (227–230)", () => {
  //   const makeInstruction = (opcode: number, rD: number, rA: number, rB: number) =>
  //     Uint8Array.of(opcode, (rB << 4) | rA, rD, Opcodes.trap);

  //   const bitmask = Uint8Array.of(0b00010001);

  //   test("227 max returns the signed maximum", () => {
  //     const code = makeInstruction(Opcodes.max, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -5n; regs[3] = 10n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(10n);
  //   });

  //   test("228 max_u returns the unsigned maximum", () => {
  //     const code = makeInstruction(Opcodes.max_u, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xFFFF_FFFF_FFFF_FFFFn; regs[3] = 1n; // large unsigned vs small unsigned
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0xFFFF_FFFF_FFFF_FFFFn);
  //   });

  //   test("229 min returns the signed minimum", () => {
  //     const code = makeInstruction(Opcodes.min, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = -100n; regs[3] = 50n;
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(-100n);
  //   });

  //   test("230 min_u returns the unsigned minimum", () => {
  //     const code = makeInstruction(Opcodes.min_u, 1, 2, 3);
  //     const regs = Array(13).fill(0n);
  //     regs[2] = 0xFFFF_FFFF_FFFF_FFFFn; regs[3] = 0n; // large unsigned vs zero
  //     const s1 = executeSingleStep(buildState({ code, bitmask, registers: regs }));
  //     expect(s1.registers[1]).toBe(0n);
  //   });
  // });

