import { buildState } from "../../../risc-pvm/interpreter/buildState";
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

  // 5) 
  // 6) 
});