import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { OK, WHO, LOW, CASH, WT, SVC_ID, ACTIVATION_FEE } from "../../../risc-pvm/interpreter/host/consts";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";

// tiny program: set r7..r10 then ecalli 20; trap
function makeCode({ d, a, l, o }: { d: bigint; a: bigint; l: bigint; o: number }) {
  const le64 = (x: bigint) => [Number(x & 0xFFn), Number((x>>8n)&0xFFn), Number((x>>16n)&0xFFn), Number((x>>24n)&0xFFn),
                               Number((x>>32n)&0xFFn), Number((x>>40n)&0xFFn), Number((x>>48n)&0xFFn), Number((x>>56n)&0xFFn)];
  const le32 = (x: number) => [x&0xFF,(x>>>8)&0xFF,(x>>>16)&0xFF,(x>>>24)&0xFF];
  
  return Uint8Array.of(
    Opcodes.load_imm_64, 7, ...le64(d),
    Opcodes.load_imm_64, 8, ...le64(a),
    Opcodes.load_imm_64, 9, ...le64(l),
    Opcodes.load_imm,    10, ...le32(o),
    Opcodes.ecalli, 20,
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(
  // mark opcode bytes: load_imm_64 (20), load_imm (??), ecalli (10), trap(0) — use the same pattern we use elsewhere in tests
  0b0000_0001, 0b0000_0100, 0b0001_0000, 0b0100_0000, 0b0101_0000
);

const HEAP = 0x10000;

function makeBlob(code: Uint8Array) {
  return buildBlob({
    meta: Uint8Array.of(0),
    jumpTbl: Uint8Array.of(0),
    z: 1,
    instr: code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
}

const mkService = (
    id: bigint, rootCodeHash: bigint, balance: bigint
  ) => ({
    storage:new Map(), preimages:new Map(), lookupStorage:new Map(),
    rootCodeHash, balance, gasAccumulate:0n, gasOnTransfer:0n,
    cores:new Uint8Array(0), selectorMap:new Map(),
    ticketNext: 0n, coresOffset: 0, ticketIndex: 0,
  });

describe("ΩT transfer handler", () => {
  it("happy path: debits sender, appends transfer, r7=OK", () => {

    
    const sender: ServiceAccount  = {
      storage: new Map(), preimages: new Map(), lookupStorage: new Map(),
      rootCodeHash: 0n, balance: 1_000n, gasAccumulate: 0n, gasOnTransfer: 5n,
      cores: new Uint8Array(), selectorMap: new Map(), 
    };
    const dest = { ...sender, balance: 0n, gasOnTransfer: 5n } as any;

    const env = makeHostEnv({
      accounts: new Map([[SVC_ID, sender], [1n, dest]]),
    }) as any;
    env.activationFee = ACTIVATION_FEE; // threshold fallback
    env.acc.allocator.env.currentServiceId = SVC_ID;

    // write memo into heap
    const memo = new Uint8Array(WT).fill(7);
    const code = makeCode({ d: 1n, a: 100n, l: 10n, o: HEAP });
    const blob = makeBlob(code);
    const st = runBlob(blob, 1_000_000, { env, memInit: (() => { const m = new Uint8Array(1<<20); m.set(memo, HEAP); return m; })() });

    expect(st.exit?.type).toBe(ExitReasonType.Panic); // trap
    expect(st.registers[7]).toBe(OK);
    expect(env.getService(SVC_ID)?.balance).toBe(900n);
    expect((env.acc.allocator.env.deltas as any).transfers?.length).toBe(1);
    expect((env.acc.allocator.env.deltas as any).transfers[0].memo).toEqual(memo);
  });

  it("WHO when dest unknown", () => {
    const env = makeHostEnv({ accounts: new Map([[SVC_ID, { balance: 1000n, gasOnTransfer: 0n } as any]]) }) as any;
    env.activationFee = 10n;
    const memo = new Uint8Array(WT).fill(1);
    const code = makeCode({ d: 123n, a: 100n, l: 10n, o: HEAP });
    const st = runBlob(makeBlob(code), 100_000, { env, memInit: (() => { const m = new Uint8Array(1<<20); m.set(memo, HEAP); return m; })() });
    expect(st.registers[7]).toBe(WHO);
  });

  it("LOW when gas limit < dest.gasOnTransfer", () => {
    const sender = { balance: 1000n, gasOnTransfer: 0n };
    const dest   = { balance: 0n,    gasOnTransfer: 50n } as any;
    const env = makeHostEnv({ accounts: new Map([[SVC_ID, sender], [1n, dest]]) }) as any;
    env.activationFee = 10n;
    const memo = new Uint8Array(WT).fill(2);
    const code = makeCode({ d: 1n, a: 100n, l: 5n, o: HEAP });
    const st = runBlob(makeBlob(code), 100_000, { env, memInit: (() => { const m = new Uint8Array(1<<20); m.set(memo, HEAP); return m; })() });
    expect(st.registers[7]).toBe(LOW);
  });

  it("CASH when amount < threshold", () => {
    const sender = { balance: 1000n, gasOnTransfer: 0n } as any;
    const dest   = { balance: 0n,    gasOnTransfer: 0n } as any;
    const env = makeHostEnv({ accounts: new Map([[SVC_ID, sender], [1n, dest]]) }) as any;
    (env as any).activationFee = 50n; // threshold
    const memo = new Uint8Array(WT).fill(3);
    const code = makeCode({ d: 1n, a: 10n, l: 10n, o: HEAP }); // 10 < 50 ⇒ CASH
    const st = runBlob(makeBlob(code), 100_000, { env, memInit: (() => { const m = new Uint8Array(1<<20); m.set(memo, HEAP); return m; })() });
    expect(st.registers[7]).toBe(CASH);
  });

  it("panic on unreadable memo page", () => {
    const sender = { balance: 1000n, gasOnTransfer: 0n } as any;
    const dest   = { balance: 0n,    gasOnTransfer: 0n } as any;
    const env = makeHostEnv({ accounts: new Map([[SVC_ID, sender], [1n, dest]]) }) as any;
    (env as any).activationFee = 0n;
    const code = makeCode({ d: 1n, a: 10n, l: 10n, o: 0x0000 }); // likely unmapped
    const st = runBlob(makeBlob(code), 100_000, { env, memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});