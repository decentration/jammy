export const GAS_PER_INSTRUCTION   = 1n   // for M1
export const GAS_HOST_CALL         = 10n  // Host call premium
export const GAS_COST_JUMP         = 10n  // Cost for jump instruction
export const JUMP_ALIGNMENT_FACTOR = 2 // ZA DJump Alignment Factor
export const GAS_COST_JUMP_IND     = 0n

export const GAS_MEM_BASE          = 10n;   // cost per memory op
export const GAS_MEM_BYTE          = 1n;    // cost per byte touched
export const GAS_IO_ACCESS         = 50n;   // cost for FEFE/FEFF IO ops