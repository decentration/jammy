import { decodeInstruction, } from "../../../risc-pvm/interpreter/instructions/decodeInstruction";
import { InstructionAddressTypes, Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";

// helper create a Uint8Array from numbers
const be8 = (...n: number[]) => Uint8Array.from(n);

// helper to build memory with a single instruction at pc=0
function instruction(opcode: number, ...tail: number[]): Uint8Array {
  return Uint8Array.from([opcode, ...tail]);
}
  
// 1) NO-OPERAND
describe("NO_OPERAND decode", () => {
  it("trap (opcode 0) returns no operands", () => {

    
    const mem = instruction(Opcodes.trap);
    const decoded = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.NO_OPERAND);
    expect(decoded.operands).toEqual([]);
  });
});

// 2) ONE-IMMEDIATE
describe("ONE_IMMEDIATE decode", () => {
  it("ecalli 0x7F returns immediate 127", () => {
    // immediate 0x7F (1-byte, positive) 
    const mem = instruction(Opcodes.ecalli, 0x7f); // 0x7f = 127
    const decoded = decodeInstruction(mem, 0);
    console.log("mem", mem);

    console.log("decoded instruction", decoded);
    expect(decoded.type).toBe(InstructionAddressTypes.ONE_IMMEDIATE);
    expect(decoded.operands).toEqual([127]); 
  });

  it("ecalli 0xFF (−1) signed-extends", () => {
    const mem = instruction(Opcodes.ecalli, 0xff); // 0xFF => −1 
    const decoded = decodeInstruction(mem, 0);
    expect(decoded.operands).toEqual([-1]);
  });
});

// 3) ONE_REGISTER_ONE_EXTENDED_IMMEDIATE  (load_imm_64)
describe("ONE_REGISTER_ONE_EXTENDED_IMMEDIATE decode", () => {
  it("load_imm_64 r=3, imm=0x0102030405060708n", () => {
    const imm = be8(0x08,0x07,0x06,0x05,0x04,0x03,0x02,0x01); // little endian
    const mem = instruction(Opcodes.load_imm_64, 0x03, ...imm);      // reg 3
    const decoded = decodeInstruction(mem, 0);

    expect(decoded.type)
      .toBe(InstructionAddressTypes.ONE_REGISTER_ONE_EXTENDED_IMMEDIATE);
    expect(decoded.operands).toBeDefined();
    expect(decoded.operands![0]).toBe(3);         // register id
    expect(decoded.operands).toBeDefined();
    expect(decoded.operands![1]).toBe(0x0102030405060708n);     // bigint
  });
});

// 4) TWO_IMMEDIATE (store*)
describe("TWO_IMMEDIATE decode", () => {
  it("store_imm_u32 with X=0x11, Y=0x22", () => {
    // opcode 32 (store_imm_u32).  Choose lX = 1 (0x11), lY = 1 (0x22)
    const mem = instruction(Opcodes.store_imm_u32, 0x01, 0x11, 0x22);
    const decoded = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.TWO_IMMEDIATE);
    expect(decoded.operands).toEqual([0x11n, 0x22n]);  // both bigint
  });
});

// 5) ONE_OFFSET
describe("ONE_OFFSET decode", () => {
  it("jump +2 bytes forward", () => {
    // opcode 40 (jump).  offset = +2 (0x02)
    const mem = instruction(Opcodes.jump, 0x02);
    const decoded = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.ONE_OFFSET);
    expect(decoded.operands?.[0]).toBe(0 + 2); // absolute target pc
  });
});

// 6) ONE_REGISTER_ONE_IMMEDIATE  (load_imm…)
describe("ONE_REGISTER_ONE_IMMEDIATE decode", () => {
  it("load_imm r=5, imm=-2", () => {
    // opcode 51.  reg nibble =5.  imm = 0xFE (−2)
    const regNibble = 0x05;   // low-nibble 5
    const mem = instruction(Opcodes.load_imm, regNibble, 0xfe);
    const decoded = decodeInstruction(mem, 0);

    expect(decoded.type)
      .toBe(InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE);
    expect(decoded.operands).toEqual([5, -2n]);
  });
});


//7) ONE_REGISTER_TWO_IMMEDIATE (store_imm_ind_u32)
describe("ONE_REGISTER_TWO_IMMEDIATE decode", () => {
    it("store_imm_ind_u32 r=4, immX=0x01020304, immY=0x0A0B0C0D", () => {
    // Opcode 72 (store_imm_ind_u32)
    // Register = 4 (lower nibble), immX = 4 bytes, immY = 4 bytes
    const opcode = Opcodes.store_imm_ind_u32;
    const regImmLengthByte = 0x44; // 0x4 (length of immX = 4) | 0x4 (register ID)
    const immX = [0x04, 0x03, 0x02, 0x01]; // little-endian
    const immY = [0x0D, 0x0C, 0x0B, 0x0A]; // little-endian

    const mem = instruction(opcode, regImmLengthByte, ...immX, ...immY);
    const decoded = decodeInstruction(mem, 0);

    expect(decoded.type)
        .toBe(InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE);
    expect(decoded.operands).toEqual([
        4, // Register ID
        0x01020304n, // immX
        0x0A0B0C0Dn  // immY
    ]);
    });
});
  
// 8) ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET
describe("ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET decode branch(νY , ⊺) , ω′ A = νX)", () => {
    it("throws error when immediate length is zero", () => {
        const opcode = Opcodes.load_imm_jump;
        const regImmLengthByte = 0x02;
        const offset = 0x05;
  
        const mem = instruction(opcode, regImmLengthByte, offset);
      
        expect(() => decodeInstruction(mem, 0))
          .toThrowError("decodeSignedIntLE: length must be 1-8");
      });
 
  });


describe("ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET decode branch(νY , ⊺) , ω′ A = νX)", () => {
  it("load_imm_ind r=2, imm=-3, offset=5", () => {
      
      const opcode = Opcodes.load_imm_jump;
      const regNibble = 0x12; // Register ID 2
      const imm = 0xfd; // -3 in signed 8-bit
      const offset = 0x05; // Offset of +5 bytes
      const mem = instruction(opcode, regNibble, imm, offset);
      const decoded = decodeInstruction(mem, 0);
      expect(decoded.type)
      .toBe(InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET);
      expect(decoded.operands).toEqual([2, -3n, 5]); // Register ID, immediate, offset. and -3n means 
      // 
  });
});

// 9) TWO_REGISTERS  (move_reg)
describe("TWO_REGISTERS decode", () => {
  it("move_reg rD=2 <- rA=9", () => {
    const opcode   = Opcodes.move_reg;      // 100
    const regByte  = (0x9 << 4) | 0x2;      // high-nibble = rA (9), low-nibble = rD (2)

    const mem      = instruction(opcode, regByte);
    const decoded  = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.TWO_REGISTERS);
    expect(decoded.operands).toEqual([2, 9]);              // [rD, rA]
  });
});
  
  
// 10) TWO_REGISTERS_ONE_IMMEDIATE  (add_imm_32)
describe("TWO_REGISTERS_ONE_IMMEDIATE decode", () => {
  it("add_imm_32 rA=3, rB=4, imm=126", () => {
    const opcode   = Opcodes.add_imm_32;    // 131
    const regByte  = (0x4 << 4) | 0x3;      // rB = 4, rA = 3
    const imm      = 0x7E;                  // +126

    const mem      = instruction(opcode, regByte, imm);
    const decoded  = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE);
    expect(decoded.operands).toEqual([3, 4, 126n]);        // bigint from decodeSignedIntLE
  });
});
  
// 11) TWO_REGISTERS_ONE_OFFSET  (branch_eq)
describe("TWO_REGISTERS_ONE_OFFSET decode", () => {
  it("branch_eq rA=1, rB=2, offset=-5", () => {
    const opcode   = Opcodes.branch_eq;     // 170
    const regByte  = (0x2 << 4) | 0x1;      // rB = 2, rA = 1
    const offset   = 0xFB;                  // -5 (signed 8-bit)

    const mem      = instruction(opcode, regByte, offset);
    const decoded  = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET);
    expect(decoded.operands).toEqual([1, 2, -5]);          // absolute pc + offset
  });
});
  
  
// 12) TWO_REGISTERS_TWO_IMMEDIATE  (load_imm_jump_ind)
describe("TWO_REGISTERS_TWO_IMMEDIATE decode", () => {
  it("load_imm_jump_ind rA=5, rB=6, immX=0x1234, immY=0x56", () => {
    const opcode   = Opcodes.load_imm_jump_ind; // 180
    const regByte  = (0x6 << 4) | 0x5;          // rB = 6, rA = 5
    const lenByte  = 0x02;                      // lX = 2 bytes
    const immX     = [0x34, 0x12];              // 0x1234 little-endian
    const immY     = [0x56];                    // 0x56

    const mem      = instruction(opcode, regByte, lenByte, ...immX, ...immY);
    const decoded  = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.TWO_REGISTERS_TWO_IMMEDIATE);
    expect(decoded.operands).toEqual([5, 6, 0x1234n, 0x56n]);
  });
});
  
  
// 13) THREE_REGISTERS  (add_32)
describe("THREE_REGISTERS decode", () => {
  it("add_32 rA=3, rB=9, rD=7", () => {
    const opcode   = Opcodes.add_32;        
    const regByte1 = (0x9 << 4) | 0x3;      // rB = 9, rA = 3 bitshift 4 to the left 
    const regByte2 = 0x07;                  // rD = 7

    const mem      = instruction(opcode, regByte1, regByte2);
    const decoded  = decodeInstruction(mem, 0);

    expect(decoded.type).toBe(InstructionAddressTypes.THREE_REGISTERS);
    expect(decoded.operands).toEqual([3, 9, 7]);
  });
});

