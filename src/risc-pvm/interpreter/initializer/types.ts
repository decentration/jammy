import { BaseInitResult } from "../types";

export type ProgramContainerParts = {
  readOnly: Uint8Array;      // (o)
  readWrite: Uint8Array;     // (w)
  reservePages: number;      // (z)
  stackSizeBytes: number;    // (s)
  code: Uint8Array;          // (c)
};

export interface StandardInitResult extends BaseInitResult {
  mapPlan: MapPlanEntry[];
  reservePages: number;
  stackSizeBytes: number;
  readOnlyLen: number;
  readWriteLen: number;
}

export interface LayoutMemory {
  memInit: Uint8Array;
  mapPlan: MapPlanEntry[];
  heapStart: number;
  heapPointer: number;  // Initial heap pointer per GP A.42: RW_BASE + P(rwLen) + reservePages*ZP
  heapEnd: number;
}

export type MapPlanEntry = { from: number; to: number; read: boolean; write: boolean };
