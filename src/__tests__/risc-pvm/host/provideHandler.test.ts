import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { NONE, OK, WHO, HUH } from "../../../risc-pvm/interpreter/host/consts";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { makeAcc, makeBlob, makeOpcodeBitmask, mkService } from "./helpers";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";
import { hash } from "../../../utils/crypto";

const HEAP = 0x18000;
const GAS  = 100_000;
const XS_ID = 0xaaaa_aaaa_aaaa_aaaAn;

function prog(s: bigint, o: number, z: number): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm_64, 7, ...toLE(s, 8),
    Opcodes.load_imm, 8,  o & 0xff, (o>>8)&0xff, (o>>16)&0xff, (o>>24)&0xff,
    Opcodes.load_imm, 9,  z & 0xff, (z>>8)&0xff, (z>>16)&0xff, (z>>24)&0xff,
    Opcodes.ecalli, 26,
    Opcodes.trap
  );
}

describe("ΩP provide handler", () => {
  it("happy path (wildcard xs): adds (xs,i) to provides; r7=OK", () => {
    // bytes i and its hash H(i)
    const I = Uint8Array.from([1,2,3,4]);
    const H = hash(I); // H(i)
    const hHex = Buffer.from(H).toString("hex");
    const z = I.length;

    // env with xs committed and currentServiceId set
    const env = makeHostEnv({ initAcc: makeAcc(XS_ID) });
    const xs = mkService(0n, 0n);
    // ledger slot (H(i), z) MUST be [] to allow provide
    xs.ledger = new Map();
    xs.ledger.set(hHex, new Map<number, Uint8Array>([[z, new Uint8Array(0)]]));
    env.acc.allocator.env.deltas.set(XS_ID, xs);

    const code = prog(NONE, HEAP, z);
    const bitmask = makeOpcodeBitmask(code, [0, 10, 16, 22, 24, 26]);

    const mem  = new Uint8Array(1<<20); mem.set(I, HEAP);

    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OK);
    // check accumulator provides list
    const iHex = Buffer.from(I).toString("hex");
    const ax = env.acc.allocator;

    expect(ax.providesSeen?.get(XS_ID)?.has(iHex)).toBe(true);

    expect(ax.provides?.length).toBe(1);
    expect(ax.provides?.[0].s).toBe(XS_ID);
    expect(ax.provides?.[0].i).toEqual(I);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("unmapped i bytes -> Panic (no mutation)", () => {
    const z = 8;
    const BAD = 0x20; // unmapped (below first page)
    const env = makeHostEnv({ initAcc: makeAcc(XS_ID) });
    // env.putService(XS_ID, mkService(0n, 0n));
    const code = prog(NONE, BAD, z);
    const bitmask = makeOpcodeBitmask(code, [0, 10, 16, 22, 24, 26]);
    const st = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);

    // nothing recorded
    expect(env.acc.allocator.provides?.length ?? 0).toBe(0);
    expect(env.acc.allocator.providesSeen?.size ?? 0).toBe(0);
  });

  it("explicit service id not staged in (xe).d -> WHO", () => {
    const I = Uint8Array.from([9,9,9]);
    const z = I.length;
    const other = 0x1234n;

    const env = makeHostEnv({ initAcc: makeAcc(XS_ID) });
    // Put service only in committed store, NOT in deltas:
    // env.putService(other, mkService(0n, 0n));
    
    const code = prog(other, HEAP, z);
    const bitmask = makeOpcodeBitmask(code, [0, 10, 16, 22, 24, 26]);

    const mem = new Uint8Array(1<<20); mem.set(I, HEAP);
    const st  = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(WHO);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("HUH if ledger slot (H(i), z) is not []", () => {
    const I = Uint8Array.from([7,7,7,7,7]);
    const H = hash(I);
    const hHex = Buffer.from(H).toString("hex");
    const z = I.length;

    const env = makeHostEnv({ initAcc: makeAcc(XS_ID) });
    const xs = mkService(0n, 0n) as ServiceAccount & { ledger?: Map<string, Map<number, Uint8Array[]>> };
    xs.ledger = new Map();
    xs.ledger.set(hHex, new Map([[z, [Uint8Array.of(1)]] ])); // not [] -> should be HUH
    env.putService(XS_ID, xs);
    env.acc.allocator.env.deltas.set(XS_ID, xs);

    const code = prog(NONE, HEAP, z);
    const bitmask = makeOpcodeBitmask(code, [0, 10, 16, 22, 24, 26]);


    const mem = new Uint8Array(1<<20); mem.set(I, HEAP);
    const st  = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(HUH);
    expect(env.acc.allocator.provides?.length ?? 0).toBe(0);
  });

  it("HUH on duplicate provide (same (s,i) in this block)", () => {
    const I = Uint8Array.from([0xaa, 0xbb, 0xcc]);
    const H = hash(I);
    const hHex = Buffer.from(H).toString("hex");
    const z = I.length;

    const env = makeHostEnv({ initAcc: makeAcc(XS_ID) });
    const xs = mkService(0n, 0n) as ServiceAccount & { ledger?: Map<string, Map<number, Uint8Array[]>> };
    xs.ledger = new Map();
    xs.ledger.set(hHex, new Map([[z, []]])); // allowed initially
    env.putService(XS_ID, xs);
    env.acc.allocator.env.deltas.set(XS_ID, xs);


    const mem = new Uint8Array(1<<20); mem.set(I, HEAP);
    const code = prog(NONE, HEAP, z);
    const bitmask = makeOpcodeBitmask(code, [0, 10, 16, 22, 24, 26]);

    // first provide -> OK
    const st1 = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });
    expect(st1.registers[7]).toBe(OK);

    // second provide same (s,i) in same block -> HUH
    const st2 = runBlob(makeBlob(code, bitmask), GAS, { env, memInit: mem });
    expect(st2.registers[7]).toBe(HUH);

    // only one entry recorded
    expect(env.acc.allocator.provides?.length).toBe(1);
  });
});
