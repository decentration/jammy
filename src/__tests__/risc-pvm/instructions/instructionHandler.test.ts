import { buildState } from "../../../risc-pvm/interpreter/buildState";
import { computeBasicBlockStarts } from "../../../risc-pvm/interpreter/computeBasicBlockStarts";
import { GAS_COST_JUMP } from "../../../risc-pvm/interpreter/consts";
import { executeSingleStep } from "../../../risc-pvm/interpreter/executeSingleStep";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { encodeProtocolInt } from "../../../codecs";
import { Bytes } from "scale-ts";
import { prettyState } from "../../../risc-pvm/interpreter/utils/debug";

describe("Instruction execution tests", () => {

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

  //   expect(state1.exit).toBeUndefined();  // Should NOT exit
  //   expect(state1.pc).toBe(1);            // Advance PC by 1
  //   expect(state1.gas).toBe(state0.gas - 1);
  // });

  // // 3) ECALLI
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

  // // 4) LOAD_IMM_64
  // it("load_imm_64 (opcode 20) loads immediate into register", () => {
  //   const code    = Uint8Array.of(
  //       Opcodes.load_imm_64,
  //       0x02,                         // rA = 2
  //       0x08, 0x07, 0x06, 0x05,       // LE payload
  //       0x04, 0x03, 0x02, 0x01
  //     );
  //   const bitmask = Uint8Array.of(0xff, 0xff, 0x0f); // 24 bits 0000 0000 0000 0000 0000 0000 1111
  //   const state0 = buildState({ code, bitmask });
  //   const state1 = executeSingleStep(state0);

  //   expect(state1.registers[2]).toBe(0x0102030405060708n);
  //   expect(state1.pc).toBe(10);
  //   expect(state1.gas).toBe(state0.gas - 1);
  //   expect(state1.exit).toBeUndefined();
  // });

  // describe("TWO_IMMEDIATE instructions", () => {
  //   // 5) store_imm_8 (opcode 30)
  //   it("store_imm_u8 (opcode 30) stores immediate byte into memory", () => {
  //     // opcode = 30 (store_imm_u8)
  //     // next byte = lX = 2 ( bytes length)
  //     // vX = 0x0100 (address, littleE)
  //     // vY = 0xAB (value to store)
  //     const code = Uint8Array.of(
  //       Opcodes.store_imm_u8,
  //       0x02,       // vX = 2 bytes
  //       0x00, 0x01, // vX = 0x0100
  //       0xAB        // vY = 0xAB
  //     );
    
  //     // opcode is first byte
  //     const bitmask = Uint8Array.of(0x01); 
    
  //     const state0 = buildState({ code, bitmask });
  //     const state1 = executeSingleStep(state0);
    
  //     const addr = 0x0100;
  //     expect(state1.memory[addr]).toBe(171);
    
  //     // PC advancement: 1 opcode + 1 length byte + 2 addr bytes + 1 value byte = 5
  //     expect(state1.pc).toBe(5);
  //     expect(state1.gas).toBe(state0.gas - 1); // 1 gas cost
  //     expect(state1.exit).toBeUndefined();
  //   });
  
  //   // 6) store_imm_u16 (opcode 31)
  //   it("store_imm_u16 (opcode 31) stores immediate value into memory address", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.store_imm_u16,
  //       0x02,          // immediate length byte: lX=2 (address length)
  //       0x00, 0x01,   // vX address = 0x0100 (LE)
  //       0xCD, 0xAB    // vY value = 0x1234 (LE)
  //     );
  //     const bitmask = Uint8Array.of(0x01, 0x00); // Opcode + 8 operands
  //     const state0 = buildState({ code, bitmask });
  //     const state1 = executeSingleStep(state0); 
  
  //     // Check memory updated correctly:
  //     const addr = 0x0100;
  //     expect(state1.memory[addr]).toBe(0xCD); // 0x1234 stored as 0x34 0x12
  //     expect(state1.memory[addr + 1]).toBe(0xAB); // 0x1234 stored as 0x34 0x12
  //     expect(state1.pc).toBe(6); // opcode(1) + lenByte(1) + vX(2) + vY(2) = 6
  //     expect(state1.gas).toBe(state0.gas - 1);
  //     expect(state1.exit).toBeUndefined(); // Continues execution
  //   });
  
  //   // 7 
  //   it("store_imm_u32 (opcode 32) stores immediate 32-bit value into memory", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.store_imm_u32,
  //       0x02,         // vX length = 2 bytes
  //       0x00, 0x01,   // vX address = 0x0100
  //       0x78, 0x56, 0x34, 0x12 // vY
  //     );
    
  //     const bitmask = Uint8Array.of(0x01);
    
  //     const state0 = buildState({ code, bitmask });
  //     const state1 = executeSingleStep(state0);
    
  //     const addr = 0x0100;
  //     expect(state1.memory[addr]).toBe(0x78);
  //     expect(state1.memory[addr + 1]).toBe(0x56);
  //     expect(state1.memory[addr + 2]).toBe(0x34);
  //     expect(state1.memory[addr + 3]).toBe(0x12);
    
  //     expect(state1.pc).toBe(8); // opcode(1) + len(1) + vX(2) + vY(4) = 8 bytes total
  //     expect(state1.gas).toBe(state0.gas - 1);
  //     expect(state1.exit).toBeUndefined();
  //   });
  
  //   // 8) store_imm_u64 (opcode 33)
  //   it("store_imm_u64 (opcode 33) stores immediate 64-bit value into memory", () => {
  //     const code = Uint8Array.of(
  //       Opcodes.store_imm_u64,
  //       0x02,              // vX length = 2 bytes
  //       0x00, 0x01,        // vX address = 0x0100
  //       0xEF, 0xCD, 0xAB, 0x89, // vY
  //       0x67, 0x45, 0x23, 0x01
  //     );
    
  //     const bitmask = Uint8Array.of(0x01, 0x00);
    
  //     const state0 = buildState({ code, bitmask });
  //     const state1 = executeSingleStep(state0);
    
  //     const addr = 0x0100;
  //     expect(state1.memory[addr]).toBe(0xEF);
  //     expect(state1.memory[addr + 1]).toBe(0xCD);
  //     expect(state1.memory[addr + 2]).toBe(0xAB);
  //     expect(state1.memory[addr + 3]).toBe(0x89);
  //     expect(state1.memory[addr + 4]).toBe(0x67);
  //     expect(state1.memory[addr + 5]).toBe(0x45);
  //     expect(state1.memory[addr + 6]).toBe(0x23);
  //     expect(state1.memory[addr + 7]).toBe(0x01);
    
  //     expect(state1.pc).toBe(12); // opcode(1) + len(1) + vX(2) + vY(8) = 12 bytes
  //     expect(state1.gas).toBe(state0.gas - 1);
  //     expect(state1.exit).toBeUndefined();
  //   });
  // }
  // );
  
  // // 9) JUMP
  // describe("executeSingleStep for jump (ONE_OFFSET)", () => {
  //   it("successfully jumps to valid basic block start", () => {
  //     // opcode 40 (jump), offset 5 bytes forward
  //     const code = Uint8Array.of(Opcodes.jump, 0x05, 0, 0, 0, Opcodes.fallthrough); 
  //     const bitmask = Uint8Array.of(0b0100001); 
  //     const state0 = buildState({ code, bitmask });
  
  //     //  execute the step
  //     const state1 = executeSingleStep(state0);

  //     console.log("State before and after jump execution:", {state0, state1});
  
  //     expect(state1.pc).toBe(5); //  jumped forward 5 bytes (opcode(1)+offset(5))
  //     expect(state1.exit?.type).toBe(ExitReasonType.Continue); // continue 
  //     expect(state1.gas).toBe(state0.gas - GAS_COST_JUMP);
  //   });

  //   it("jumps to the immediate next byte (offset=1)", () => {
  //     const code = Uint8Array.of(Opcodes.jump, Opcodes.fallthrough, 0);
  //     const bitmask = Uint8Array.of(0b00000011);
  //     const state0 = buildState({ code, bitmask });
    
  //     const state1 = executeSingleStep(state0);
    
  //     expect(state1.pc).toBe(1);
  //     expect(state1.exit?.type).toBe(ExitReasonType.Continue);
  //   });

  //   it("panics if jump target is out of bounds", () => {
  //     const code = Uint8Array.of(Opcodes.jump, 10, 0, 0, 0);
  //     const bitmask = Uint8Array.of(0b00000001);
    
  //     const state0 = buildState({ code, bitmask });
  //     const state1 = executeSingleStep(state0);
    
  //     expect(state1.exit?.type).toBe(ExitReasonType.Panic);
  //     expect(state1.pc).toBe(0); 
  //   });

  //   it("panics if jump target is not a basic block start", () => {
  //     const code = Uint8Array.of(Opcodes.jump, 3, 0, 0, Opcodes.fallthrough);
  //     // bitmask => 0 and 4 are opcodes, index 3 is not an opcode
  //     // code length= 5 => jump from 0 + 3 = 3, but 3 is not an opcode => panic
  //     const bitmask = Uint8Array.of(0b00001001);
    
  //     const state0 = buildState({ code, bitmask });
  //     const state1 = executeSingleStep(state0);
    
  //     expect(state1.exit?.type).toBe(ExitReasonType.Panic);
  //     expect(state1.pc).toBe(0);
  //   });
  
  //   it(" panics when jumping to invalid block start", () => {
  //     // opcode 40 (jump),  offset to invalid block (3 bytes forward)
  //     const code = Uint8Array.of(Opcodes.jump, 0x03);
  //     const bitmask = Uint8Array.of(0b00000001); // opcode at position 0
  //     const state0 = buildState({ code, bitmask });

  //     const state1 = executeSingleStep(state0);
  
  //     expect(state1.exit?.type).toBe(ExitReasonType.Panic); 
  //     expect(state1.pc).toBe(state0.pc); 
  //     expect(state1.gas).toBe(state0.gas - GAS_COST_JUMP);
  //   });
  // });

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

  // 11 load_imm
  describe("Opcode 51 and 52 tests", () => {

    it("Opcode 51 - load_imm stores immediate into register", () => {
      const code = Uint8Array.of(Opcodes.load_imm, 0x02, 0x99, 0x00, Opcodes.trap); // r2 = 0x99
      const bitmask = Uint8Array.of(0x00010001); // in hex is 0x11

  
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0);

      console.log("State after load_imm execution:", prettyState(state1));
  
      expect(state1.registers[2]).toBe(0x99n); // decimal 153
      expect(state1.pc).toBe(5);
      expect(state1.exit).toBeUndefined();
    });
  
    it("Opcode 52 - load_u8 loads unsigned byte from memory into register", () => {
      const code = Uint8Array.of(Opcodes.load_u8, 0x01, 0x10, 0x00); // r1, imm=0x0010 (address)
      const bitmask = Uint8Array.of(0x01, 0x00);
  
      const state0 = buildState({ code, bitmask });
      state0.memory[0x0010] = 0xAB; // memory at 0x0010 = 0xAB
  
      const state1 = executeSingleStep(state0);
  
      expect(state1.registers[1]).toBe(0xABn); // decimal 
      expect(state1.pc).toBe(4); // opcode(1) + register(1) + imm(2)
      expect(state1.exit).toBeUndefined();
    });
  
    it("Opcode 52 - panics if memory address is out of bounds (OOB)", () => {
      const code = Uint8Array.of(Opcodes.load_u8, 0x00, 0xFF, 0xFF); // address = 0xFFFF
      const bitmask = Uint8Array.of(0x01, 0x00);
  
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0);
  
      expect(state1.exit?.type).toBe(ExitReasonType.Panic);
    });

    it("52 load_u8 loads unsigned 0xAB into r1", () => {
      // 0x0020 LE → 0x20 0x00
      const code = Uint8Array.of(
        Opcodes.load_u8, 0x01, 0x20, 0x00,
        Opcodes.trap              // delimiter
      );
      const bitmask = Uint8Array.of(0x11);  // bits 0 and 4
  
      const s0 = buildState({ code, bitmask });
      s0.memory[0x0020] = 0xAB;
  
      const s1 = executeSingleStep(s0);
      expect(s1.registers[1]).toBe(0xABn);
      expect(s1.pc).toBe(4);
      expect(s1.exit).toBeUndefined();
    });
  
    //53 
    it("53 load_i8 sign-extends 0x80 → -128n into r2", () => {
      // address 0x0030 → bytes 0x30 0x00
      const code = Uint8Array.of(
        Opcodes.load_i8, 0x02, 0x30, 0x00,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const s0 = buildState({ code, bitmask });
      s0.memory[0x0030] = 0x80;            // negative 128 in 8-bit
  
      const s1 = executeSingleStep(s0);
      expect(s1.registers[2]).toBe(-128n);
      expect(s1.exit).toBeUndefined();
    });
  
    //54 
    it("54 load_u16 loads 0x1234 into r3", () => {
      const code = Uint8Array.of(
        Opcodes.load_u16, 0x03, 0x40, 0x00,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const s0 = buildState({ code, bitmask });
      s0.memory.set([0x34, 0x12], 0x0040); // LE 0x1234
  
      const s1 = executeSingleStep(s0);
      expect(s1.registers[3]).toBe(0x1234n);
      expect(s1.exit).toBeUndefined();
    });
  
    //55 
    it("55 load_i16 sign-extends 0x8001 → -32767n into r4", () => {
      const code = Uint8Array.of(
        Opcodes.load_i16, 0x04, 0x50, 0x00,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const s0 = buildState({ code, bitmask });
      s0.memory.set([0x01, 0x80], 0x0050); // 0x8001
  
      const s1 = executeSingleStep(s0);
      expect(s1.registers[4]).toBe(-32767n);
      expect(s1.exit).toBeUndefined();
    });
  
    //56 
    it("56 load_u32 loads 0xCAFEBABE into r5", () => {
      const code = Uint8Array.of(
        Opcodes.load_u32, 0x05, 0x60, 0x00,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const s0 = buildState({ code, bitmask });
      s0.memory.set([0xBE, 0xBA, 0xFE, 0xCA], 0x0060);
  
      const s1 = executeSingleStep(s0);
      expect(s1.registers[5]).toBe(0xCAFEBABEn);
      expect(s1.exit).toBeUndefined();
    });
  
    //57
    it("57 load_i32 sign-extends 0x80000001 → -2147483647n into r6", () => {
      const code = Uint8Array.of(
        Opcodes.load_i32, 0x06, 0x70, 0x00,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const s0 = buildState({ code, bitmask });
      s0.memory.set([0x01, 0x00, 0x00, 0x80], 0x0070);
  
      const s1 = executeSingleStep(s0);
      expect(s1.registers[6]).toBe(-2147483647n);
      expect(s1.exit).toBeUndefined();
    });
  
    it("58 load_u64 loads 0x1122334455667788n into r7", () => {
      const code = Uint8Array.of(
        Opcodes.load_u64, 0x07, 0x80, 0x00,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const s0 = buildState({ code, bitmask });
      s0.memory.set(
        [0x88,0x77,0x66,0x55,0x44,0x33,0x22,0x11],
        0x0080
      );
  
      const s1 = executeSingleStep(s0);
      expect(s1.registers[7]).toBe(0x1122334455667788n);
      expect(s1.exit).toBeUndefined();
    });
  
    it("opcode 58 load_u64 panics on out of bounds address", () => {
      // addr = 0x03FFFC  (3-byte LE: FC FF 03) – plus 7 bytes read ⇒ OOB
      const code = Uint8Array.of(
        Opcodes.load_u64, 0x00, 0xFC, 0xFF, 0x03,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x21);   // bits 0 and 5
  
      const s0 = buildState({ code, bitmask });
      const s1 = executeSingleStep(s0);
  
      expect(s1.exit?.type).toBe(ExitReasonType.Panic);
    });
  });

  describe("A.5.6 STORE opcodes 59–62", () => {

    it("59 store_u8 writes least-significant byte of r3 into memory", () => {
      //  rA = 3, addr = 0x0100  → bytes 0x00 0x01
      const code = Uint8Array.of(
        Opcodes.store_u8, 0x03, 0x00, 0x01,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);      // bits 0,4
  
      const regs = Array(13).fill(0n);
      regs[3] = 0xA5B6n;                         // any value, LS-byte = 0xB6
  
      const s0 = buildState({ code, bitmask, registers: regs });
      const s1 = executeSingleStep(s0);
  
      expect(s1.memory[0x0100]).toBe(0xB6);
      expect(s1.exit).toBeUndefined();
    });
  
    it("60 store_u16 writes two little-endian bytes from r4", () => {
      // addr = 0x0120
      const code = Uint8Array.of(
        Opcodes.store_u16, 0x04, 0x20, 0x01,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const regs = Array(13).fill(0n);
      regs[4] = 0xAABBn;                     // LS-word = 0xAABB
  
      const s0 = buildState({ code, bitmask, registers: regs });
      const s1 = executeSingleStep(s0);
  
      expect(s1.memory[0x0120]).toBe(0xBB);
      expect(s1.memory[0x0121]).toBe(0xAA);
      expect(s1.exit).toBeUndefined();
    });
  
    // 61
    it("61 store_u32 writes four bytes from r5", () => {
      const code = Uint8Array.of(
        Opcodes.store_u32, 0x05, 0x40, 0x01,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const regs = Array(13).fill(0n);
      regs[5] = 0xDEADBEEFn;
  
      const s0 = buildState({ code, bitmask, registers: regs });
      const s1 = executeSingleStep(s0);
  
      const base = 0x0140;
      expect(s1.memory[base + 0]).toBe(0xEF);
      expect(s1.memory[base + 1]).toBe(0xBE);
      expect(s1.memory[base + 2]).toBe(0xAD);
      expect(s1.memory[base + 3]).toBe(0xDE);
      expect(s1.exit).toBeUndefined();
    });
  
    //62    
    it("62 store_u64 writes full 64-bit little-endian from r6", () => {
      const code = Uint8Array.of(
        Opcodes.store_u64, 0x06, 0x80, 0x01,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x11);
  
      const regs = Array(13).fill(0n);
      regs[6] = 0x0123456789ABCDEFn;
  
      const s0 = buildState({ code, bitmask, registers: regs });
      const s1 = executeSingleStep(s0);
  
      const b = 0x0180;
      const expectBytes = [0xEF,0xCD,0xAB,0x89,0x67,0x45,0x23,0x01];
      expectBytes.forEach((byte,i)=> expect(s1.memory[b + i]).toBe(byte));
      expect(s1.exit).toBeUndefined();
    });
  
    // 62    
    it("store_u64 panics on out-of-bounds write", () => {
      // addr = 0x03FFFC (needs 3-byte imm)  +7 bytes -> OOB
      const code = Uint8Array.of(
        Opcodes.store_u64, 0x00,
        0xFC, 0xFF, 0x03,
        Opcodes.trap
      );
      const bitmask = Uint8Array.of(0x21);   // bits 0 and 5
  
      const regs = Array(13).fill(0n);
      regs[0] = 0x123n;
  
      const s0 = buildState({ code, bitmask, registers: regs });
      const s1 = executeSingleStep(s0);
  
      expect(s1.exit?.type).toBe(ExitReasonType.Panic);
    });
  }
  );
 });
