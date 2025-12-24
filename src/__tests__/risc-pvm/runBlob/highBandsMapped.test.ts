import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { ARGS_BASE, ZI, STACK_START, STACK_TOP } from "../../../risc-pvm/interpreter/host/consts";

const u8 = (xs: number[]) => new Uint8Array(xs);

describe("runBlob maps stack(R/W) and args(R) bands", () => {
  test("page table reflects A.7 bands", () => {
    // A.2 blob inside an A.38 container header:
    // - meta: 1 byte (so deblobMetadata can strip it)
    // - |j| = 0
    // - z   = 1
    // - |c| = 0
    // - Ez(j) = []
    // - E(c)  = []
    // - E(k)  = []
    const blob = buildBlob({
      meta: u8([0xaa]),
      z: 1,
      instr: u8([0x00]),
      jumpEntries: [],
      bitmaskBits: u8([0b00000001])
    });

    const gas = 100_000n;
    const st = runBlob(blob, gas, { memSize: 1 << 20 }); // 1 MiB RAM

    expect(st.context).toBeDefined()
    const pt = st.context!.pageTable;
    const get = (page: number) => pt[page] ?? { read: false, write: false };

    // Stack pages: R/W
    const stackStartPage = STACK_START >>> 16;
    const stackEndPage = STACK_TOP >>> 16;
    expect(get(stackStartPage).read).toBe(true);
    expect(get(stackStartPage).write).toBe(true);
    if (stackEndPage > stackStartPage) {
      const mid = Math.floor((stackStartPage + stackEndPage - 1) / 2);
      expect(get(mid).read).toBe(true);
      expect(get(mid).write).toBe(true);
    }

    // Args pages: R only
    const argsStartPage = ARGS_BASE >>> 16;
    const argsEndPage = (ARGS_BASE + ZI) >>> 16;
    expect(get(argsStartPage).read).toBe(true);
    expect(get(argsStartPage).write).toBe(false);
    if (argsEndPage > argsStartPage) {
      const mid = Math.floor((argsStartPage + argsEndPage - 1) / 2);
      expect(get(mid).read).toBe(true);
      expect(get(mid).write).toBe(false);
    }
  });
});
