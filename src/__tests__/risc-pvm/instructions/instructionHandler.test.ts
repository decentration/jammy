import { cons } from "fp-ts/lib/ReadonlyNonEmptyArray";
import { buildState } from "../../../risc-pvm/interpreter/buildState";
import { computeBasicBlockStarts } from "../../../risc-pvm/interpreter/computeBasicBlockStarts";
import { GAS_COST_JUMP } from "../../../risc-pvm/interpreter/consts";
import { executeSingleStep } from "../../../risc-pvm/interpreter/executeSingleStep";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

describe("Instruction execution tests", () => {

  // 1) NO-OPERAND
  it("trap (opcode 0) sets Panic exit reason", () => {
    const code = Uint8Array.of(Opcodes.trap);
    const bitmask = Uint8Array.of(0xff); // 8 bits enough for 1 opcode
    const state0 = buildState({ code, bitmask });
    const state1 = executeSingleStep(state0);

    expect(state1.exit?.type).toBe(ExitReasonType.Panic);
    expect(state1.pc).toBe(0);
    expect(state1.gas).toBe(state0.gas - 1);
  });

  // 2) FALLTHROUGH
  it("fallthrough (opcode 1) increments PC without exiting", () => {
    const code = Uint8Array.of(Opcodes.fallthrough, Opcodes.trap);
    const bitmask = Uint8Array.of(0xff); // 8 bits enough for 2 opcodes
    const state0 = buildState({ code, bitmask });
    const state1 = executeSingleStep(state0);

    expect(state1.exit).toBeUndefined();  // Should NOT exit
    expect(state1.pc).toBe(1);            // Advance PC by 1
    expect(state1.gas).toBe(state0.gas - 1);
  });

  // 3) ECALLI
  it("ecalli (opcode 10) sets HostCall exit reason with immediate", () => {
    const code = Uint8Array.of(Opcodes.ecalli, 0x05);
    const bitmask = Uint8Array.of(0x01) // 1 on bit and 7 off bits for opcode 10
    const state0 = buildState({ code, bitmask });
    const state1 = executeSingleStep(state0);

    expect(state1.exit?.type).toBe(ExitReasonType.HostCall);
    expect(state1.exit?.id).toBe(5n);
    expect(state1.pc).toBe(2);
    expect(state1.gas).toBe(state0.gas - 10);
  });

  // 4) LOAD_IMM_64
  it("load_imm_64 (opcode 20) loads immediate into register", () => {
    const code    = Uint8Array.of(
        Opcodes.load_imm_64,
        0x02,                         // rA = 2
        0x08, 0x07, 0x06, 0x05,       // LE payload
        0x04, 0x03, 0x02, 0x01
      );
    const bitmask = Uint8Array.of(0xff, 0xff, 0x0f); // 24 bits 0000 0000 0000 0000 0000 0000 1111
    const state0 = buildState({ code, bitmask });
    const state1 = executeSingleStep(state0);

    expect(state1.registers[2]).toBe(0x0102030405060708n);
    expect(state1.pc).toBe(10);
    expect(state1.gas).toBe(state0.gas - 1);
    expect(state1.exit).toBeUndefined();
  });

  describe("TWO_IMMEDIATE instructions", () => {
    // 5) store_imm_8 (opcode 30)
    it("store_imm_u8 (opcode 30) stores immediate byte into memory", () => {
      // opcode = 30 (store_imm_u8)
      // next byte = lX = 2 ( bytes length)
      // vX = 0x0100 (address, littleE)
      // vY = 0xAB (value to store)
      const code = Uint8Array.of(
        Opcodes.store_imm_u8,
        0x02,       // vX = 2 bytes
        0x00, 0x01, // vX = 0x0100
        0xAB        // vY = 0xAB
      );
    
      // opcode is first byte
      const bitmask = Uint8Array.of(0x01); 
    
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0);
    
      const addr = 0x0100;
      expect(state1.memory[addr]).toBe(171);
    
      // PC advancement: 1 opcode + 1 length byte + 2 addr bytes + 1 value byte = 5
      expect(state1.pc).toBe(5);
      expect(state1.gas).toBe(state0.gas - 1); // 1 gas cost
      expect(state1.exit).toBeUndefined();
    });
  
    // 6) store_imm_u16 (opcode 31)
    it("store_imm_u16 (opcode 31) stores immediate value into memory address", () => {
      const code = Uint8Array.of(
        Opcodes.store_imm_u16,
        0x02,          // immediate length byte: lX=2 (address length)
        0x00, 0x01,   // vX address = 0x0100 (LE)
        0xCD, 0xAB    // vY value = 0x1234 (LE)
      );
      const bitmask = Uint8Array.of(0x01, 0x00); // Opcode + 8 operands
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0); 
  
      // Check memory updated correctly:
      const addr = 0x0100;
      expect(state1.memory[addr]).toBe(0xCD); // 0x1234 stored as 0x34 0x12
      expect(state1.memory[addr + 1]).toBe(0xAB); // 0x1234 stored as 0x34 0x12
      expect(state1.pc).toBe(6); // opcode(1) + lenByte(1) + vX(2) + vY(2) = 6
      expect(state1.gas).toBe(state0.gas - 1);
      expect(state1.exit).toBeUndefined(); // Continues execution
    });
  
    // 7 
    it("store_imm_u32 (opcode 32) stores immediate 32-bit value into memory", () => {
      const code = Uint8Array.of(
        Opcodes.store_imm_u32,
        0x02,         // vX length = 2 bytes
        0x00, 0x01,   // vX address = 0x0100
        0x78, 0x56, 0x34, 0x12 // vY
      );
    
      const bitmask = Uint8Array.of(0x01);
    
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0);
    
      const addr = 0x0100;
      expect(state1.memory[addr]).toBe(0x78);
      expect(state1.memory[addr + 1]).toBe(0x56);
      expect(state1.memory[addr + 2]).toBe(0x34);
      expect(state1.memory[addr + 3]).toBe(0x12);
    
      expect(state1.pc).toBe(8); // opcode(1) + len(1) + vX(2) + vY(4) = 8 bytes total
      expect(state1.gas).toBe(state0.gas - 1);
      expect(state1.exit).toBeUndefined();
    });
  
    // 8) store_imm_u64 (opcode 33)
    it("store_imm_u64 (opcode 33) stores immediate 64-bit value into memory", () => {
      const code = Uint8Array.of(
        Opcodes.store_imm_u64,
        0x02,              // vX length = 2 bytes
        0x00, 0x01,        // vX address = 0x0100
        0xEF, 0xCD, 0xAB, 0x89, // vY
        0x67, 0x45, 0x23, 0x01
      );
    
      const bitmask = Uint8Array.of(0x01, 0x00);
    
      const state0 = buildState({ code, bitmask });
      const state1 = executeSingleStep(state0);
    
      const addr = 0x0100;
      expect(state1.memory[addr]).toBe(0xEF);
      expect(state1.memory[addr + 1]).toBe(0xCD);
      expect(state1.memory[addr + 2]).toBe(0xAB);
      expect(state1.memory[addr + 3]).toBe(0x89);
      expect(state1.memory[addr + 4]).toBe(0x67);
      expect(state1.memory[addr + 5]).toBe(0x45);
      expect(state1.memory[addr + 6]).toBe(0x23);
      expect(state1.memory[addr + 7]).toBe(0x01);
    
      expect(state1.pc).toBe(12); // opcode(1) + len(1) + vX(2) + vY(8) = 12 bytes
      expect(state1.gas).toBe(state0.gas - 1);
      expect(state1.exit).toBeUndefined();
    });
  }
  );
  
  // 9) JUMP
  describe("executeSingleStep for jump (ONE_OFFSET)", () => {
    it("successfully jumps to valid basic block start", () => {
      // opcode 40 (jump), offset 5 bytes forward
      const code = Uint8Array.of(Opcodes.jump, 0x05, 0, 0, 0, Opcodes.fallthrough); 
      const bitmask = Uint8Array.of(0b0100001); 
      const state0 = buildState({ code, bitmask });
  
      //  compute basic block starts
      const basicBlockStarts = computeBasicBlockStarts(code, state0.opcodeMaskBits);
      console.log("Basic block starts:", basicBlockStarts);
      basicBlockStarts.add(5); //  adding 6 (0 + opcode(0) + offset(5)) as valid block start
      console.log("Updated basic block starts:", basicBlockStarts);
  
      //  execute the step
      const state1 = executeSingleStep(state0);

      console.log("State before and after jump execution:", {state0, state1});
  
      expect(state1.pc).toBe(5); //  jumped forward 5 bytes (opcode(1)+offset(5))
      expect(state1.exit?.type).toBe(ExitReasonType.Running); // continue 
      expect(state1.gas).toBe(state0.gas - GAS_COST_JUMP);
    });

    it("jumps to the immediate next byte (offset=1)", () => {
      const code = Uint8Array.of(Opcodes.jump, Opcodes.fallthrough, 0);
      const bitmask = Uint8Array.of(0b00000011);
      const state0 = buildState({ code, bitmask });
    
      const state1 = executeSingleStep(state0);
    
      expect(state1.pc).toBe(1);
      expect(state1.exit?.type).toBe(ExitReasonType.Running);
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
      const code = Uint8Array.of(Opcodes.jump, 3, 0, 0, Opcodes.fallthrough);
      // bitmask => 0 and 4 are opcodes, index 3 is not an opcode
      // code length= 5 => jump from 0 + 3 = 3, but 3 is not an opcode => panic
      const bitmask = Uint8Array.of(0b00001001);
    
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
  
      // Basic block does NOT include pc=4
      const basicBlockStarts = computeBasicBlockStarts(code, state0.opcodeMaskBits);
      basicBlockStarts.add(5); //  valid block at pc=5, but not 4
  
      const state1 = executeSingleStep(state0);
  
      expect(state1.exit?.type).toBe(ExitReasonType.Panic); 
      expect(state1.pc).toBe(state0.pc); 
      expect(state1.gas).toBe(state0.gas - GAS_COST_JUMP);
    });
  });

  
});