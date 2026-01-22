export const GAS_PER_INSTRUCTION = 1n   // Base cost for each instruction per Graypaper Appendix A.5
export const GAS_HOST_CALL = 10n  // Host call cost per Graypaper B.5 (B.15-B.16): g=10
export const GAS_COST_JUMP = 1n   // Cost for jump instruction per Graypaper A.5.5 (opcode 40)
export const JUMP_ALIGNMENT_FACTOR = 2 // ZA DJump Alignment Factor
export const GAS_COST_JUMP_IND = 1n   // Indirect jump cost per Graypaper A.5.6 (opcode 50)

export const GAS_MEM_BASE = 10n;   // cost per memory op
export const GAS_MEM_BYTE = 1n;    // cost per byte touched
export const GAS_IO_ACCESS = 50n;   // cost for FEFE/FEFF IO ops