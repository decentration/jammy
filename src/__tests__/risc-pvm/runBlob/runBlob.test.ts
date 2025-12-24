import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { prettyState } from "../../../risc-pvm/interpreter/utils/debug";


describe("runBlob VM Execution Integration Tests", () => {


    const buildBlobForTest = (instructions: Uint8Array, bitmask: Uint8Array): Uint8Array => {
        
      // Minimal valid blob structure for these tests
      return buildBlob({
        meta: Uint8Array.of(0x00),
        jumpTbl: Uint8Array.of(0x00), // Minimal jump table, though length needs to be updated if jump entries change
        z: 1,
        instr: instructions,
        jumpEntries: [Uint8Array.of(0x00)],
        bitmaskBits: bitmask,
      });
    };
  
    it("1. Simple VM execution stops at trap opcode", async () => {
        const code = Uint8Array.of(
            Opcodes.load_imm_64, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // r0 = 1
            Opcodes.load_imm_64, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, // r1 = 2
            Opcodes.add_64, 0x10, 0x02, // r2 = r0 + r1
            Opcodes.trap
          );
        
        
          const bitmask = Uint8Array.of(
            0b00000001, // byte 0 opcode
            0b00000100, // byte 10 opcode
            0b10010000  // byte 20 and 23 opcode
          );
                  
  
      const blob = buildBlobForTest(code, bitmask);
  
      const state = await runBlob(blob, 100);
      console.log("state after execution:", state);
      
      expect(state.registers[2]).toBe(3n);
      expect(state.exit?.type).toBe(ExitReasonType.Panic);
    });
  
    it("2. VM halts execution when out of gas", async () => {
      const code = Uint8Array.of(
        Opcodes.load_imm_64, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        Opcodes.load_imm_64, 0x01, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        Opcodes.add_64, 0x10, 0x02,
        Opcodes.add_64, 0x20, 0x02, 
        Opcodes.add_64, 0x20, 0x02, 
        Opcodes.trap
      );
  
      const bitmask = Uint8Array.of(0b00000001, 0b00000100, 0b10010000, 0b00100100);
      const blob = buildBlobForTest(code, bitmask);
  
      const state = await runBlob(blob, 5); // Intentionally small gas
      expect(state.gas).toBeLessThanOrEqual(0);
      expect(state.exit?.type).toBe(ExitReasonType.OutOfGas);
    });
  
    it("3. VM executes jump instruction correctly", async () => {
      const code = Uint8Array.of(
        Opcodes.jump, 0b00000110, 0x00, 0x00, 0x00,    
        Opcodes.trap,      
        Opcodes.load_imm_64, 0x00, 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 
        Opcodes.trap
      );
  
      const bitmask = Uint8Array.of(0b01100001, 0b00000000, 0b00000001);
      const blob = buildBlobForTest(code, bitmask);
  
      const state = await runBlob(blob, 50);
      console.log("state after jump execution:", prettyState(state));
      expect(state.registers[0]).toBe(255n);
      expect(state.exit?.type).toBe(ExitReasonType.Panic);
    });
  
    it("4. Correct jump_ind usage", async () => {

        const code = Uint8Array.of(
          Opcodes.load_imm, 0x00, 0x08,0,0,0,// r0 = 8     
          Opcodes.jump_ind, 0x00, 0x04,0,0,0,     
          Opcodes.trap                            
        );
      
        const jumpTbl = Uint8Array.of(0,0,0,0,0,12,0,0,0,0,0,0,0,0);
        const jumpEntries = [
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),

        ]; // arbitrary jump entries, only jump table is used in jump_ind

        const bitmask = Uint8Array.of(0b01000001, 0b00110000);
        const blob = buildBlob({ meta: Uint8Array.of(0), jumpTbl, z: 2, instr: code, jumpEntries, bitmaskBits: bitmask });
      
        const state = await runBlob(blob, 2000);
        console.log("state after jump_ind execution:", prettyState(state));
      
        expect(state.registers[0]).toBe(8n);
        expect(state.exit?.type).toBe(ExitReasonType.Panic); // Trap leads to Panic exit
      });

      it("5. Correct jump_ind usage followed by load_imm_64", async () => {

        const code = Uint8Array.of(
            Opcodes.load_imm, 0x00, 0x04,0,0,0,   // pc=0: r0 = 4
            Opcodes.jump_ind, 0x00, 0x08,0,0,0,   // pc=6: jump_ind: jump to address 4 + 4 = 8
            Opcodes.fallthrough,                  // land here then move to pc 13
            Opcodes.load_imm_64, 0x01,            // pc=13: load_imm_64 r1, 0xBB
            0xBB,0,0,0,0,0,0,0,
            Opcodes.trap                          // pc=23
        );
    
        const jumpTbl = Uint8Array.of(0,0,0,0,0,0x0C,0,0,0,0,0,0);

        const jumpEntries = [
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00),
            Uint8Array.of(0x00, 0x00), 
        ];
    
        const bitmask = Uint8Array.of(
            0b01000001, // pc=0, pc=6
            0b00010000, // pc=12
            0b10000000  // pc=23
        );
    
        const blob = buildBlob({
            meta: Uint8Array.of(0),
            jumpTbl,
            z: 2,
            instr: code,
            jumpEntries,
            bitmaskBits: bitmask
        });
    
        const state = await runBlob(blob, 2000);
    
        expect(state.registers[1]).toBe(187n);
        expect(state.exit?.type).toBe(ExitReasonType.Panic);
    });

  
  });
  