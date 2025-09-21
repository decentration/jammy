// ---- Machine State

export type MachineEntry = { p: Uint8Array; u: InnerMachineState; i: number };

export enum Access { None = 0, R = 1, W = 2, RW = 3 }

export type InnerMachineState = {
  vPages: Map<number, Uint8Array>; // bytes
  aPages: Map<number, Access>; // per page permissions
};

// -----