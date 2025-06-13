

export interface Instruction {
    type: InstructionAddressTypes;
    opcode: Opcodes;
    operands?: (number | bigint | Uint8Array)[];
}

export enum InstructionAddressTypes {
    NO_OPERAND = "no_operand",                 // A.5.1 Instructions without Arguments.
    ONE_IMMEDIATE = "one_immediate",           // A.5.2. Instructions with Arguments of One Immediate.
    TWO_IMMEDIATE = "two_immediate",           // A.5.4. Instructions with Arguments of Two Immediates.
    ONE_REGISTER_ONE_EXTENDED_IMMEDIATE = "one_register_one_extended_immediate", // A.5.3. Instructions with Arguments of One Register and One Extended Width Immediate.
    ONE_OFFSET = "one_offset",                                  // A.5.5. Instructions with Arguments of One Offset.
    ONE_REGISTER_ONE_IMMEDIATE = "one_register_one_immediate",  // A.5.6. Instructions with Arguments of One Register & One Immediate.
    ONE_REGISTER_TWO_IMMEDIATE = "one_register_two_immediate",  // A.5.7. Instructions with Arguments of One Register & Two Immediates.
    ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET = "one_register_one_immediate_one_offset", // A.5.8. Instructions with Arguments of One Register, One Immediate and One Offset.
    TWO_REGISTERS = "two_registers",           // A.5.9. Instructions with Arguments of Two Registers.
    TWO_REGISTERS_ONE_IMMEDIATE = "two_registers_one_immediate", // A.5.10. Instructions with Arguments of Two Registers & One Immediate.
    TWO_REGISTERS_ONE_OFFSET = "two_registers_one_offset",       // A.5.11. Instructions with Arguments of Two Registers & One Offset.
    TWO_REGISTERS_TWO_IMMEDIATE = "two_registers_two_immediate", // A.5.12. Instruction with Arguments of Two Registers and Two Immediates.
    THREE_REGISTERS = "three_registers",       // A.5.13. Instructions with Arguments of Three Registers.
}

export const INSTRUCTION_ADDRESS_TYPES: InstructionAddressTypes[] = [
    InstructionAddressTypes.NO_OPERAND, // A.5.1
    InstructionAddressTypes.ONE_IMMEDIATE, // A.5.2
    InstructionAddressTypes.ONE_REGISTER_ONE_EXTENDED_IMMEDIATE, // A.5.3
    InstructionAddressTypes.TWO_IMMEDIATE, // A.5.4
    InstructionAddressTypes.ONE_OFFSET, // A.5.5
    InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE, // A.5.6
    InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE, // A.5.7
    InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET, // A.5.8
    InstructionAddressTypes.TWO_REGISTERS, // A.5.9
    InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE, // A.5.10
    InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET, // A.5.11
    InstructionAddressTypes.TWO_REGISTERS_TWO_IMMEDIATE, // A.5.12
    InstructionAddressTypes.THREE_REGISTERS // A.5.13
];

export enum Opcodes {
    // A.5.1
    trap = 0, 
    fallthrough = 1, 

    // A.5.2
    ecalli =  10, //0x0A , 

     // A.5.3
    load_imm_64 = 20,

    // A.5.4
    store_imm_u8 = 30, 
    store_imm_u16 = 31, 
    store_imm_u32 = 32, 
    store_imm_u64 = 33, 

    // A.5.5
    jump = 40, 

    // A.5.6
    jump_ind = 50, 
    load_imm = 51,
    load_u8 = 52,
    load_i8 = 53,
    load_u16 = 54,
    load_i16 = 55,
    load_u32 = 56,
    load_i32 = 57,
    load_u64 = 58,
    store_u8 = 59,
    store_u16 = 60,
    store_u32 = 61,
    store_u64 = 62,

    // A.5.7
    store_imm_ind_u8 = 70,
    store_imm_ind_u16 = 71,
    store_imm_ind_u32 = 72,
    store_imm_ind_u64 = 73,

    // A.5.8
    load_imm_jump = 80, 
    branch_eq_imm = 81, 
    branch_ne_imm = 82, 
    branch_lt_u_imm = 83, // less than unsigned 
    branch_le_u_imm = 84, //  less than or equal to
    branch_ge_u_imm = 85, // greater than or equal to
    branch_gt_u_imm = 86, // greater than
    branch_lt_s_imm = 87, // signed less than
    branch_le_s_imm = 88, // signed less than or equal to
    branch_ge_s_imm = 89, // signed greater than or equal to
    branch_gt_s_imm = 90, // signed greater than

    // A.5.9
    move_reg = 100, 
    sbrk = 101, 
    count_set_bits_64 = 102,
    count_set_bits_32 = 103,
    leading_zero_bits_64 = 104,
    leading_zero_bits_32 = 105,
    trailing_zero_bits_64 = 106,
    trailing_zero_bits_32 = 107,
    sign_extend_8 = 108,
    sign_extend_16 = 109,
    zero_extend_16 = 110,
    reverse_bytes = 111,

    // A.5.10
    store_ind_u8 = 120,
    store_ind_u16 = 121,
    store_ind_u32 = 122,
    store_ind_u64 = 123,
    load_ind_u8 = 124,
    load_ind_i8 = 125,
    load_ind_u16 = 126,
    load_ind_i16 = 127,
    load_ind_u32 = 128,
    load_ind_i32 = 129,
    load_ind_u64 = 130,
    add_imm_32 = 131,
    and_imm = 132,
    xor_imm = 133,
    or_imm = 134,
    mul_imm_32 = 135,
    set_lt_u_imm = 136,
    set_lt_s_imm = 137,
    shlo_l_imm_32 = 138, // shift left logical
    shlo_r_imm_32 = 139, // shift right logical
    shar_r_imm_32 = 140, // shift right arithmetic
    neg_add_imm_32 = 141, // negate and add immediate
    set_gt_u_imm = 142, // set greater than unsigned immediate
    set_get_s_imm = 143, // set greater than signed immediate
    shlo_l_imm_alt_32 = 144, // alternative shift left logical
    shlo_r_imm_alt_32 = 145, // alternative shift right logical
    shar_r_imm_alt_32 = 146, // alternative shift right arithmetic
    cmov_iz_imm = 147, // conditional move if zero immediate
    cmov_nz_imm = 148, // conditional move if not zero immediate
    add_imm_64 = 149, // add immediate 64-bit
    mul_imm_64 = 150, // multiply immediate 64-bit
    shlo_l_imm_64 = 151, // shift left logical immediate 64-bit
    shlo_r_imm_64 = 152, // shift right logical immediate 64-bit
    shar_r_imm_64 = 153, // shift right arithmetic immediate 64-bit
    neg_add_imm_64 = 154, // negate and add immediate 64-bits
    shlo_l_imm_alt_64 = 155, // alternative shift left logical immediate 64-bit
    shlo_r_imm_alt_64 = 156, // alternative shift right logical immediate 64-bit
    shar_r_imm_alt_64 = 157, // alternative shift right arithmetic immediate 64-bit
    rot_r_64_imm = 158, // rotate right 64-bit immediate
    rot_r_64_imm_alt = 159, // alternative rotate right 64-bit immediate
    rot_r_32_imm = 160, // rotate right 32-bit immediate
    rot_r_32_imm_alt = 161, // alternative rotate right 32-bit immediate

    // A.5.11
    branch_eq = 170, // branch if equal
    branch_ne = 171, // branch if not equal
    branch_lt_u = 172, // branch if less than unsigned
    branch_lt_s = 173, // branch if less than signed
    branch_ge_u = 174, // branch if greater than or equal unsigned
    branch_ge_s = 175, // branch if greater than or equal signed

    // A.5.12
    load_imm_jump_ind = 180, // load immediate and jump indirect

    // A.5.13
    add_32 = 190, // add 32-bit
    sub_32 = 191, // subtract 32-bit
    mul_32 = 192, // multiply 32-bit
    div_u_32 = 193, // divide unsigned 32-bit
    div_s_32 = 194, // divide signed 32-bit
    mod_u_32 = 195, // modulo unsigned 32-bit
    rem_u_32 = 196, // remainder unsigned 32-bit
    rem_s_32 = 197, // remainder signed 32-bit
    shlo_l_32 = 198, // shift left logical 32-bit
    shlo_r_32  = 199, // shift right logical 32-bit
    shar_r_32 = 200, // shift right arithmetic 32-bit
    add_64 = 201, // add 64-bit
    mul_64 = 202, // multiply 64-bit
    div_u_64 = 203, // divide unsigned 64-bit
    div_s_64 = 204, // divide signed 64-bit
    rem_u_64 = 205, // modulo unsigned 64-bit
    rem_s_64 = 206, // remainder signed 64-bit
    shlo_l_64 = 207, // shift left logical 64-bit
    shlo_r_64 = 208, // shift right logical 64-bit
    shar_r_64 = 209, // shift right arithmetic 64-bit
    and = 210, // bitwise AND
    xor = 211, // bitwise XOR
    or = 212, // bitwise OR
    mul_upper_s_s = 213, // multiply upper signed
    mul_upper_u_u = 214, // multiply upper unsigned
    mul_upper_s_u = 215, // multiply upper signed and unsigned
    set_lt_u = 216, // set less than unsigned
    set_lt_s = 217, // set less than signed
    cmov_iz = 218, // conditional move if zero
    cmov_nz = 219, // conditional move if not zero
    rot_l_64 = 220, // rotate left 64-bit
    rot_l_32 = 221, // rotate left 32-bit
    rot_r_64 = 222, // rotate right 64-bit
    rot_r_32 = 223, // rotate right 32-bit
    and_inv = 224, // bitwise AND with inversion
    or_inv = 225, // bitwise OR with inversion
    xnor = 226, // bitwise XNOR
    max = 227, // maximum value
    max_u = 228, // maximum unsigned value
    min = 229, // minimum value
    min_u = 230, // minimum unsigned value
}

export const OpcodeTable: Record<Opcodes, InstructionAddressTypes> = {
    [Opcodes.trap]: InstructionAddressTypes.NO_OPERAND,
    [Opcodes.fallthrough]: InstructionAddressTypes.NO_OPERAND,
    [Opcodes.ecalli]: InstructionAddressTypes.ONE_IMMEDIATE,
    [Opcodes.load_imm_64]: InstructionAddressTypes.ONE_REGISTER_ONE_EXTENDED_IMMEDIATE,
    [Opcodes.store_imm_u8]: InstructionAddressTypes.TWO_IMMEDIATE,
    [Opcodes.store_imm_u16]: InstructionAddressTypes.TWO_IMMEDIATE,
    [Opcodes.store_imm_u32]: InstructionAddressTypes.TWO_IMMEDIATE,
    [Opcodes.store_imm_u64]: InstructionAddressTypes.TWO_IMMEDIATE,
    [Opcodes.jump]: InstructionAddressTypes.ONE_OFFSET,
    [Opcodes.jump_ind]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_u8]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_i8]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_u16]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_i16]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_u32]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_i32]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.load_u64]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.store_u8]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.store_u16]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.store_u32]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.store_u64]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE,
    [Opcodes.store_imm_ind_u8]: InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE,
    [Opcodes.store_imm_ind_u16]: InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE,
    [Opcodes.store_imm_ind_u32]: InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE,
    [Opcodes.store_imm_ind_u64]: InstructionAddressTypes.ONE_REGISTER_TWO_IMMEDIATE,
    [Opcodes.load_imm_jump]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_eq_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_ne_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_lt_u_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_le_u_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_ge_u_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_gt_u_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_lt_s_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_le_s_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_ge_s_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.branch_gt_s_imm]: InstructionAddressTypes.ONE_REGISTER_ONE_IMMEDIATE_ONE_OFFSET,
    [Opcodes.move_reg]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.sbrk]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.count_set_bits_64]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.count_set_bits_32]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.leading_zero_bits_64]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.leading_zero_bits_32]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.trailing_zero_bits_64]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.trailing_zero_bits_32]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.sign_extend_8]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.sign_extend_16]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.zero_extend_16]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.reverse_bytes]: InstructionAddressTypes.TWO_REGISTERS,
    [Opcodes.store_ind_u8]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.store_ind_u16]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.store_ind_u32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.store_ind_u64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.load_ind_u8]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.load_ind_i8]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.load_ind_u16]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.load_ind_i16]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.load_ind_u32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.load_ind_i32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.load_ind_u64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.add_imm_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.and_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.xor_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.or_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.mul_imm_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.set_lt_u_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.set_lt_s_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_l_imm_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_r_imm_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shar_r_imm_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.neg_add_imm_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.set_gt_u_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.set_get_s_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_l_imm_alt_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_r_imm_alt_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shar_r_imm_alt_32]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.cmov_iz_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.cmov_nz_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.add_imm_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.mul_imm_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_l_imm_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_r_imm_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shar_r_imm_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.neg_add_imm_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_l_imm_alt_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shlo_r_imm_alt_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.shar_r_imm_alt_64]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.rot_r_64_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.rot_r_64_imm_alt]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.rot_r_32_imm]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.rot_r_32_imm_alt]: InstructionAddressTypes.TWO_REGISTERS_ONE_IMMEDIATE,
    [Opcodes.branch_eq]: InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET,
    [Opcodes.branch_ne]: InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET,
    [Opcodes.branch_lt_u]: InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET,
    [Opcodes.branch_lt_s]: InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET,
    [Opcodes.branch_ge_u]: InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET,
    [Opcodes.branch_ge_s]: InstructionAddressTypes.TWO_REGISTERS_ONE_OFFSET,
    [Opcodes.load_imm_jump_ind]: InstructionAddressTypes.TWO_REGISTERS_TWO_IMMEDIATE,
    [Opcodes.add_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.sub_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.mul_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.div_u_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.div_s_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.mod_u_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rem_u_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rem_s_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.shlo_l_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.shlo_r_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.shar_r_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.add_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.mul_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.div_u_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.div_s_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rem_u_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rem_s_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.shlo_l_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.shlo_r_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.shar_r_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.and]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.xor]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.or]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.mul_upper_s_s]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.mul_upper_u_u]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.mul_upper_s_u]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.set_lt_u]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.set_lt_s]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.cmov_iz]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.cmov_nz]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rot_l_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rot_l_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rot_r_64]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.rot_r_32]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.and_inv]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.or_inv]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.xnor]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.max]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.max_u]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.min]: InstructionAddressTypes.THREE_REGISTERS,
    [Opcodes.min_u]: InstructionAddressTypes.THREE_REGISTERS,
};


export const TERMINATION_OPCODES = new Set([
    Opcodes.trap,
    Opcodes.fallthrough,
    Opcodes.jump,
    Opcodes.jump_ind,
    Opcodes.load_imm_jump,
    Opcodes.load_imm_jump_ind,
    Opcodes.branch_eq,
    Opcodes.branch_ne,
    Opcodes.branch_ge_u,
    Opcodes.branch_ge_s,
    Opcodes.branch_lt_u,
    Opcodes.branch_lt_s,
    Opcodes.branch_eq_imm,
    Opcodes.branch_ne_imm,
    Opcodes.branch_lt_u_imm,
    Opcodes.branch_lt_s_imm,
    Opcodes.branch_le_u_imm,
    Opcodes.branch_le_s_imm,
    Opcodes.branch_ge_u_imm,
    Opcodes.branch_ge_s_imm,
    Opcodes.branch_gt_u_imm,
    Opcodes.branch_gt_s_imm,
  ]);