import { SVC_ID, HUH, OK, D } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { makeAcc, mkService, makeBlob, tuple } from "./helpers";


const HEAP = 0x18000;
const GAS  = 100_000;
const FORGET_DELAY =BigInt(D);


function prog(off: number, z: number): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm,  7,  off & 0xff, (off>>8)&0xff, (off>>16)&0xff, (off>>24)&0xff,
    Opcodes.load_imm,  8,  z & 0xff,   (z>>8)&0xff,   (z>>16)&0xff,   (z>>24)&0xff,
    Opcodes.ecalli, 24,
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001, 0b0101_0000);
const hToHex = (h: Uint8Array) => Buffer.from(h).toString("hex");

describe("ΩF forget handler", () => {
  it("Panic when 32B hash unreadable", () => {
    const xsId = SVC_ID;
    const env = makeHostEnv({ initAcc: makeAcc(xsId) });

    // off is below 64 KiB -> low-memory 
    const st = runBlob(makeBlob(prog(0x20, 0), bitmask), GAS, { env, memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("HUH when (h,z) missing", () => {
    const xsId = SVC_ID;
    const env = makeHostEnv({ initAcc: makeAcc(xsId), now: 1_000n });
    const xs = mkService(0n, 0n);
    xs.ledger = new Map(); // empty ledger

    const h = new Uint8Array(32).fill(0x11); 
    const mem = new Uint8Array(1<<20); mem.set(h, HEAP);

    const st = runBlob(makeBlob(prog(HEAP, 7), bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(HUH);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("[] -> deletes (h,z) and removes h from preimages; r7=OK; staged only", () => {
    const xsId = SVC_ID;
    const now  = FORGET_DELAY;
    const env = makeHostEnv({ initAcc: makeAcc(xsId), now });

    const xs = mkService(0n, 0n);
    const h = new Uint8Array(32).fill(0x22);
    const hHex = hToHex(h);

    // preimages include h; ledger has (h,z) -> []
    xs.preimages.set(hHex, Uint8Array.of(1,2,3));
    const inner = new Map<number, Uint8Array>(); inner.set(3, new Uint8Array());
    xs.ledger = new Map([[hHex, inner]]);
    env.putService(xsId, xs);

    const mem = new Uint8Array(1<<20); mem.set(h, HEAP);
    const st  = runBlob(makeBlob(prog(HEAP, 3), bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OK);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);

    // persistent unchanged
    const xsPersist = env.getService(xsId)!;
    expect(xsPersist.ledger!.get(hHex)?.has(3)).toBe(true);
    expect(xsPersist.preimages.has(hHex)).toBe(true);

    // staged updated
    const staged = env.acc.allocator.env.deltas.get(xsId) as ServiceAccount;
    expect(staged.ledger?.get(hHex)).toBeUndefined(); // removed entire inner map
    expect(staged.preimages.has(hHex)).toBe(false);
  });

  it("[x] -> [x, t] where t=now; r7=OK", () => {
    const xsId = SVC_ID;
    const now  = FORGET_DELAY;
    const env = makeHostEnv({ initAcc: makeAcc(xsId), now });

    const xs = mkService(0n, 0n);
    const h = new Uint8Array(32).fill(0x33);
    const hHex = hToHex(h);

    const inner = new Map<number, Uint8Array>(); inner.set(4, tuple(123n));
    xs.ledger = new Map([[hHex, inner]]);
    env.putService(xsId, xs);

    const mem = new Uint8Array(1<<20); mem.set(h, HEAP);
    const st  = runBlob(makeBlob(prog(HEAP, 4), bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OK);

    const staged = env.acc.allocator.env.deltas.get(xsId) as ServiceAccount;
    const t = staged.ledger!.get(hHex)!.get(4)!;
    expect(t.length).toBe(16);

    // check last 8 bytes = now (LE)
    const y = BigInt(t[8]) | (BigInt(t[9])<<8n) | (BigInt(t[10])<<16n) | (BigInt(t[11])<<24n) |
             (BigInt(t[12])<<32n) | (BigInt(t[13])<<40n) | (BigInt(t[14])<<48n) | (BigInt(t[15])<<56n);
    expect(y).toBe(now);
  });

  it("[x,y] with y < t-D -> delete (h,z) and remove preimage; r7=OK", () => {
    const xsId = SVC_ID;
    const now  = FORGET_DELAY + 1_000n;     // ensure t − D > 0
    const env = makeHostEnv({ initAcc: makeAcc(xsId), now });

    const xs = mkService(0n, 0n);
    const h = new Uint8Array(32).fill(0x44);
    const hHex = hToHex(h);

    xs.preimages.set(hHex, Uint8Array.of(9));
    const inner = new Map<number, Uint8Array>(); inner.set(5, tuple(1n, 1n)); // y=1 < now
    xs.ledger = new Map([[hHex, inner]]);
    env.putService(xsId, xs);

    const mem = new Uint8Array(1<<20); mem.set(h, HEAP);
    const st  = runBlob(makeBlob(prog(HEAP, 5), bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OK);

    const staged = env.acc.allocator.env.deltas.get(xsId) as ServiceAccount;
    expect(staged.ledger?.get(hHex)).toBeUndefined();
    expect(staged.preimages.has(hHex)).toBe(false);
  });

  it("[x,y,w] with y < t-D -> becomes [w,t]; r7=OK", () => {
    const xsId = SVC_ID;
    const now  = FORGET_DELAY + 777n;
    const env = makeHostEnv({ initAcc: makeAcc(xsId), now });

    const xs = mkService(0n, 0n);
    const h = new Uint8Array(32).fill(0x55);
    const hHex = hToHex(h);

    const inner = new Map<number, Uint8Array>(); inner.set(6, tuple(123n, 1n, 999n)); // y=1 < now-D   
    xs.ledger = new Map([[hHex, inner]]);
    env.putService(xsId, xs);

    const mem = new Uint8Array(1<<20); mem.set(h, HEAP);
    const st  = runBlob(makeBlob(prog(HEAP, 6), bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OK);

    const staged = env.acc.allocator.env.deltas.get(xsId) as ServiceAccount;
    const enc = staged.ledger!.get(hHex)!.get(6)!;
    expect(enc.length).toBe(16); // [w,t]
    
    // read low 8 as w (=999)
    const w0 = BigInt(enc[0]) | (BigInt(enc[1])<<8n) | (BigInt(enc[2])<<16n) | (BigInt(enc[3])<<24n) |
            (BigInt(enc[4])<<32n) | (BigInt(enc[5])<<40n) | (BigInt(enc[6])<<48n) | (BigInt(enc[7])<<56n);
    expect(w0).toBe(999n);
  });

  it("[x,y] with y >= t-D -> HUH (no mutation)", () => {
    const xsId = SVC_ID;
    const now  = 100n;
    const env = makeHostEnv({ initAcc: makeAcc(xsId), now });

    const xs = mkService(0n, 0n);
    const h = new Uint8Array(32).fill(0x66);
    const hHex = hToHex(h);

    const inner = new Map<number, Uint8Array>(); inner.set(2, tuple(7n, now)); // y == now -> not < t
    xs.ledger = new Map([[hHex, inner]]);

    const mem = new Uint8Array(1<<20); mem.set(h, HEAP);
    const st  = runBlob(makeBlob(prog(HEAP, 2), bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(HUH);
    // no staged mutation recorded for xs
    expect(env.acc.allocator.env.deltas.has(xsId)).toBe(false);
  });
});
