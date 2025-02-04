export interface AncestorItem {
    slot: number;
    header_hash: Uint8Array;
  }
  
  // off‐chain store:
  export interface AncestorsOffChainState {
    blocks: AncestorItem[];              // ring buffer, capacity ~ L
    indexMap: Map<string, number>;       // key = `${slot}-${hex(headerHash)}`, value = index in blocks
    maxCapacity: number;                 // L, 14400 in production and 60 fo rtiny. 
    earliestSlot: number;                // track min slot, for faster eviction
  }
  

  export interface AncestorsInput {
    newBlocks: AncestorItem[]; // newly finalized blocks
    currentSlot: number;       // for cleaning up older blocks
  }
  