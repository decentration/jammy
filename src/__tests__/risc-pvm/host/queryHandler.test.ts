import { SVC_ID, NONE } from "../../../risc-pvm/interpreter/host/consts";
import { ledgerPut } from "../../../risc-pvm/interpreter/host/handlers/accumulate/helpers";
import { HostEnvInterface, makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { makeBlob, makeOpcodeBitmask, mkService, tuple } from "./helpers";

const HEAP = 0x18000;  // where we place the 32 byte hash h
const GAS  = 100_000;

function prog(o: number, z: number): Uint8Array {
  // r7=o (hash ptr), r8=z (index), ecalli 22 (ΩQ), trap
  return Uint8Array.of(
    Opcodes.load_imm, 7,  o & 0xff, (o>>8)&0xff, (o>>16)&0xff, (o>>24)&0xff,
    Opcodes.load_imm, 8,  z & 0xff, (z>>8)&0xff, (z>>16)&0xff, (z>>24)&0xff,
    Opcodes.ecalli, 22,
    Opcodes.trap
  );
}

function putLedgerCommitted(
  env: HostEnvInterface,
  xsId: bigint,
  hHex: string,
  z: number,
  tuple: Uint8Array
) {
  const xs = (env.getService(xsId) ?? mkService(xsId, 0n, 0n)) as ServiceAccount;
  ledgerPut(xs, hHex, z, tuple);
  env.putService(xsId, xs);
}

describe("ΩQ query handler", () => {
  it("panic when hash pointer unmapped", () => {
    const code = prog(0x20, 0); // low page => unmapped
    const bitmask = makeOpcodeBitmask(code, [0, 6, 12, 14]);
    const env  = makeHostEnv({ initAcc: { allocator: { env: { currentServiceId: SVC_ID, deltas: new Map() } } } as any });
    const st   = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("missing ledger entry -> r7=NONE, r8=0", () => {
    const env  = makeHostEnv({ initAcc: { allocator: { env: { currentServiceId: SVC_ID, deltas: new Map() } } } as any });
    env.putService(SVC_ID, mkService(SVC_ID, 0n, 0n));

    const H = new Uint8Array(32).fill(0xAB);
    const mem = new Uint8Array(1<<20); mem.set(H, HEAP);
    const code = prog(HEAP, 5);
    const bitmask = makeOpcodeBitmask(code, [0, 6, 12, 14]);
    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(NONE);
    expect(st.registers[8]).toBe(0n);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("returns code 0 and r8=0 when (h, z) exists but the entry is empty []", () => {
    const env  = makeHostEnv({ initAcc: { allocator: { env: { currentServiceId: SVC_ID, deltas: new Map() } } } as any });
    env.putService(SVC_ID, mkService(SVC_ID, 0n, 0n));

    const H = new Uint8Array(32).map((_,i)=>i&0xff);
    const Hhex = Buffer.from(H).toString("hex");
    const mem = new Uint8Array(1<<20); mem.set(H, HEAP);

    // empty tuple => 0-length value
    putLedgerCommitted(env, SVC_ID, Hhex, 3, new Uint8Array(0));
    const xs = (env.getService(SVC_ID) ?? mkService(SVC_ID, 0n, 0n)) as ServiceAccount;
    ledgerPut(xs, Hhex, 3, tuple());
    env.putService(SVC_ID, xs);

    const code = prog(HEAP, 3);
    const bitmask = makeOpcodeBitmask(code, [0, 6, 12, 14]);

    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(0n);
    expect(st.registers[8]).toBe(0n);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("encodes a single-element witness [x] as r7=1 + (x<<32), r8=0", () => {
    const env  = makeHostEnv({ initAcc: { allocator: { env: { currentServiceId: SVC_ID, deltas: new Map() } } } as any });
    env.putService(SVC_ID, mkService(SVC_ID, 0n, 0n));

    const H = new Uint8Array(32).fill(7);
    const Hhex = Buffer.from(H).toString("hex");
    const mem = new Uint8Array(1<<20); mem.set(H, HEAP);

    const x = 7n;
    putLedgerCommitted(env, SVC_ID, Hhex, 1, tuple(x));
    const code = prog(HEAP, 1);
    const bitmask = makeOpcodeBitmask(code, [0, 6, 12, 14]);

    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(1n + (x << 32n));
    expect(st.registers[8]).toBe(0n);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("encodes a two-element witness [x, y] as r7=2 + (x<<32) and r8=y", () => {
    const env  = makeHostEnv({ initAcc: { allocator: { env: { currentServiceId: SVC_ID, deltas: new Map() } } } as any });
    env.putService(SVC_ID, mkService(SVC_ID, 0n, 0n));

    const H = new Uint8Array(32).fill(0xCC);
    const Hhex = Buffer.from(H).toString("hex");
    const mem = new Uint8Array(1<<20); mem.set(H, HEAP);

    const x = 5n; 
    const y = 1234n;
    putLedgerCommitted(env, SVC_ID, Hhex, 2, tuple(x, y));

    const code = prog(HEAP, 2);
    const bitmask = makeOpcodeBitmask(code, [0, 6, 12, 14]);

    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(2n + (x << 32n));
    expect(st.registers[8]).toBe(y);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("encodes a three-element witness [x, y, z] as r7=3 + (x<<32) and r8=y + (z<<32)", () => {
    const env  = makeHostEnv({ initAcc: { allocator: { env: { currentServiceId: SVC_ID, deltas: new Map() } } } as any });
    env.putService(SVC_ID, mkService(SVC_ID, 0n, 0n));

    const H = new Uint8Array(32).map((_,i)=> (i*9)&0xff);
    const Hhex = Buffer.from(H).toString("hex");
    const mem = new Uint8Array(1<<20); mem.set(H, HEAP);

    const x = 9n;
    const y = 0x1122n;
    const z = 0x3344n;

    putLedgerCommitted(env, SVC_ID, Hhex, 0, tuple(x, y, z));

    const code = prog(HEAP, 0);
    const bitmask = makeOpcodeBitmask(code, [0, 6, 12, 14]);

    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(3n + (x << 32n));
    expect(st.registers[8]).toBe(y + (z << 32n));
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
