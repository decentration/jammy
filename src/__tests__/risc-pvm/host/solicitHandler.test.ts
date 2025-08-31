import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { FULL, HASH_BYTES, HUH, OK, SVC_ID } from "../../../risc-pvm/interpreter/host/consts";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { makeBlob, mkService, tuple } from "./helpers";
import type { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";

const HEAP = 0x18000;
const GAS  = 100_000;

function prog(o: number, z: number): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  o & 0xff, (o>>8)&0xff, (o>>16)&0xff, (o>>24)&0xff,   // r7 <- o
    Opcodes.load_imm, 8,  z & 0xff, (z>>8)&0xff, (z>>16)&0xff, (z>>24)&0xff,   // r8 <- z
    Opcodes.ecalli, 23,
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001, 0b0101_0000);

describe("ΩS solicit handler", () => {
  it("missing (h,z) -> creates [] in ledger; r7=OK; staged only", () => {
    const env = makeHostEnv();
    // payer xs with enough balance
    const xs = mkService(SVC_ID, 0n, 1_000n) as ServiceAccount;
    xs.ledger = new Map();
    env.putService(SVC_ID, xs);
    env.acc.allocator.env.currentServiceId = SVC_ID;

    const h = new Uint8Array(HASH_BYTES).map((_, i) => (i * 3) & 0xff); // 32 bytes of 0xff
    const mem = new Uint8Array(1 << 20); // 1MB
    mem.set(h, HEAP);

    const code = prog(HEAP, 7);
    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(OK);

    // committed unchanged
    const committed = env.getService(SVC_ID)!;
    expect(committed.ledger?.get(Buffer.from(h).toString("hex"))?.get(7)).toBeUndefined();

    // staged shows []
    const staged = env.acc.allocator.env.deltas.get(SVC_ID) as ServiceAccount;
    const inner = staged.ledger!.get(Buffer.from(h).toString("hex"))!;
    const v = inner.get(7)!;
    expect(v).toBeInstanceOf(Uint8Array);
    expect(v.length).toBe(0);
  });

  it("[x,y] present -> appends t to [x,y,t]; r7=OK; t=env.now()", () => {
    const NOW = 123_456n;
    const env = makeHostEnv({ now: NOW });
    const xs = mkService(SVC_ID, 0n, 1_000n) as ServiceAccount;

    const h = new Uint8Array(HASH_BYTES).fill(0xaa);
    const hHex = Buffer.from(h).toString("hex");

    // pre-populate ledger with [x,y]
    const inner = new Map<number, Uint8Array>();
    inner.set(99, tuple(42n, 13n));

    xs.ledger = new Map([[hHex, inner]]);
    env.putService(SVC_ID, xs);
    env.acc.allocator.env.currentServiceId = SVC_ID;

    const mem = new Uint8Array(1 << 20); mem.set(h, HEAP);
    const st = runBlob(makeBlob(prog(HEAP, 99), bitmask), GAS, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(OK);

    const staged = env.acc.allocator.env.deltas.get(SVC_ID) as ServiceAccount;
    const got = staged.ledger!.get(hHex)!.get(99)!;
    expect(got.length).toBe(24);

    // check the last 8 bytes = NOW (LE)
    const tail = got.subarray(16, 24);
    const nowLE = toLE(NOW, 8);
    expect(Buffer.from(tail).toString("hex")).toBe(Buffer.from(nowLE).toString("hex"));
  });

  it("malformed existing value (e.g. []) -> HUH, no staging", () => {
    const env = makeHostEnv();
    const xs = mkService(SVC_ID, 0n, 1_000n) as ServiceAccount;

    const h = new Uint8Array(HASH_BYTES).fill(0x7a);
    const hHex = Buffer.from(h).toString("hex");

    // existing [] (length 0) should be rejected (HUH)
    const inner = new Map<number, Uint8Array>();
    inner.set(5, new Uint8Array(0));

    xs.ledger = new Map([[hHex, inner]]);
    env.putService(SVC_ID, xs);
    env.acc.allocator.env.currentServiceId = SVC_ID;

    const mem = new Uint8Array(1 << 20); mem.set(h, HEAP);
    const st = runBlob(makeBlob(prog(HEAP, 5), bitmask), GAS, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(HUH);

    // no staged update
    expect(env.acc.allocator.env.deltas.has(SVC_ID)).toBe(false);
  });

  it("FULL when xs.balance < activationFee; no staging", () => {
    const env = makeHostEnv();
    (env as any).activationFee = 50n;

    const xs = mkService(SVC_ID, 0n, 10n) as ServiceAccount; // balance below fee
    xs.ledger = new Map();
    env.putService(SVC_ID, xs);
    env.acc.allocator.env.currentServiceId = SVC_ID;

    const h = new Uint8Array(HASH_BYTES).fill(1);
    const mem = new Uint8Array(1 << 20); mem.set(h, HEAP);

    const st = runBlob(makeBlob(prog(HEAP, 1), bitmask), GAS, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(FULL);
    expect(env.acc.allocator.env.deltas.has(SVC_ID)).toBe(false);
  });

  it("unmapped 32B hash pointer -> Panic", () => {
    const env = makeHostEnv();
    const xs = mkService(SVC_ID, 0n, 1_000n) as ServiceAccount;
    env.putService(SVC_ID, xs);
    env.acc.allocator.env.currentServiceId = SVC_ID;

    // use low address within panic zone (helpers readBytes -> panic)
    const BAD = 0x0020;
    const st = runBlob(makeBlob(prog(BAD, 0), bitmask), GAS, { env, memInit: new Uint8Array(1 << 20) });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
