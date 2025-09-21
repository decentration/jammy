import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { AccumulateContext, DesignationEntry } from "../../../risc-pvm/interpreter/host/types";

describe("makeHostEnv deep-copy semantics", () => {
  it("clones (xe).deltas and (xe).deleted", () => {
    const initAcc: Partial<AccumulateContext> = {
      allocator: {
        env: {
          deltas: new Map<bigint, any>([[999n, { seed: true }]]),
          deleted: new Set<bigint>([77n]),
        },
        index: 0n
      },
    };

    const envA = makeHostEnv({ initAcc });
    const envB = makeHostEnv({ initAcc });

    envA.acc.allocator.env.deltas.set(1n, { from: "A" });
    envA.acc.allocator.env.deleted?.add(42n);

    expect(envB.acc.allocator.env.deltas.has(1n)).toBe(false);
    expect(envB.acc.allocator.env.deleted?.has(42n)).toBe(false);
  });

  it("deep-clones transfers array and memo buffers", () => {
    const initAcc: Partial<AccumulateContext> = {
      allocator: {
        transfers: [
          { from: 1n, to: 2n, amount: 3n, gasLimit: 4n, memo: Uint8Array.of(9) },
        ],
        index: 0n,
        env: {
          deltas: new Map<bigint, any>(),
          deleted: new Set<bigint>(),
          designations: new Map<number, bigint>(),
          designationEntries: new Map<bigint, DesignationEntry>(),
          assignServiceAccount: new Map<number, bigint>(),
          assignCore: new Map<number, Uint8Array>(),
        }
      },
    };

    const envA = makeHostEnv({ initAcc });
    const envB = makeHostEnv({ initAcc });

    // mutate A
    envA.acc.allocator.transfers![0].memo[0] = 99;
    envA.acc.allocator.transfers!.push({
      from: 9n,
      to: 8n,
      amount: 7n,
      gasLimit: 6n,
      memo: Uint8Array.of(5),
    });

    // verify B is unaffected
    expect(envB.acc.allocator.transfers?.length).toBe(1);
    expect(envB.acc.allocator.transfers?.[0].memo[0]).toBe(9);
  });

  it("clones designations map and designationEntries map", () => {
    const bound = new Uint8Array(32).fill(1);
    const entries = new Map<bigint, DesignationEntry>([
      [42n, { boundCodeHash32: bound, role: 2, witnessBaseOffset: 81 }],
    ]);

    const initAcc: Partial<AccumulateContext> = {
      allocator: {
        env: {
          deltas: new Map<bigint, any>(),
          designations: new Map<number, bigint>([[1, 42n]]),
          designationEntries: entries,
        },
        index: 0n
      },
    };

    const envA = makeHostEnv({ initAcc });
    const envB = makeHostEnv({ initAcc });

    envA.acc.allocator.env.designations?.set(2, 99n);
    envA.acc.allocator.env.designationEntries?.set(99n, {
      boundCodeHash32: new Uint8Array(32).fill(2),
      role: 2,
      witnessBaseOffset: 81,
    });

    expect(envB.acc.allocator.env.designations?.has(2)).toBe(false);
    expect(envB.acc.allocator.env.designationEntries?.has(99n)).toBe(false);
  });

  it("clones assignServiceAccount and assignCore (and buffers inside)", () => {
    const initAcc: Partial<AccumulateContext> = {
      allocator: {
        env: {
          deltas: new Map<bigint, any>(),
          assignServiceAccount: new Map<number, bigint>([[0, 1n]]),
          assignCore: new Map<number, Uint8Array>([[0, new Uint8Array(32)]]),
        },
        index: 0n
      },
    };

    const envA = makeHostEnv({ initAcc });
    const envB = makeHostEnv({ initAcc });

    envA.acc.allocator.env.assignServiceAccount?.set(1, 2n);
    const core0A = envA.acc.allocator.env.assignCore?.get(0)!;
    core0A[0] = 123;

    expect(envB.acc.allocator.env.assignServiceAccount?.get(1)).toBeUndefined();
    const core0B = envB.acc.allocator.env.assignCore?.get(0)!;
    expect(core0B[0]).toBe(0);
  });

  it("clones providesSeen (Map<sid, Set<string>>)", () => {
    const initAcc: Partial<AccumulateContext> = {
      allocator: {
        providesSeen: new Map<bigint, Set<string>>([[123n, new Set(["seedhex"])]]),
        index: 0n,
        env: {
          deltas: new Map<bigint, any>(),
          deleted: new Set<bigint>(),
          designations: new Map<number, bigint>(),
          designationEntries: new Map<bigint, DesignationEntry>(),
          assignServiceAccount: new Map<number, bigint>(),
          assignCore: new Map<number, Uint8Array>(),
        }
      },
    };

    const envA = makeHostEnv({ initAcc });
    const envB = makeHostEnv({ initAcc });

    const setA = envA.acc.allocator.providesSeen?.get(123n) ?? new Set<string>();
    setA.add("deadbeefA");
    envA.acc.allocator.providesSeen?.set(123n, setA);

    expect(envB.acc.allocator.providesSeen?.get(123n)?.has("deadbeefA")).toBe(false);
  });

  it("deep-copies provides array and payloads (if seeded)", () => {
    const initAcc: Partial<AccumulateContext> = {
      allocator: {
        provides: [{ s: 555n, i: Uint8Array.of(7, 8, 9) }],
        index: 0n,
        env: {
          deltas: new Map<bigint, any>(),
          deleted: new Set<bigint>(),
          designations: new Map<number, bigint>(),
          designationEntries: new Map<bigint, DesignationEntry>(),
          assignServiceAccount: new Map<number, bigint>(),
          assignCore: new Map<number, Uint8Array>(),
        }
      },
    };

    const envA = makeHostEnv({ initAcc });
    const envB = makeHostEnv({ initAcc });

    envA.acc.allocator.provides![0].i[0] = 42;
    envA.acc.allocator.provides!.push({ s: 321n, i: Uint8Array.of(4, 5, 6) });

    expect(envB.acc.allocator.provides?.length).toBe(1);
    expect(envB.acc.allocator.provides?.[0].i[0]).toBe(7);
  });
});
