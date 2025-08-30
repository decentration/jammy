import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { HASH_BYTES, OK } from "../../../risc-pvm/interpreter/host/consts";
import { makeBlob } from "./helpers";

const HEAP = 0x18000;
const GAS  = 100;

function prog(off = HEAP): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  off & 0xff, (off>>8)&0xff, (off>>16)&0xff, (off>>24)&0xff,
    Opcodes.ecalli, 25,
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001,0b0000_0001);

describe("ΩY yield handler", () => {
  it("happy path: reads 32B at o, stages into acc.session.yield, r7=OK", () => {
    const H = new Uint8Array(HASH_BYTES).map((_, i) => (i * 13) & 0xff);
    const mem = new Uint8Array(1<<20); mem.set(H, HEAP);

    const env = makeHostEnv(); // acc.session.yield starts undefined
    const blob = makeBlob(prog(HEAP), bitmask );

    const st = runBlob(blob, GAS, { env, memInit: mem });

    // host sets r7=OK; panic occurs after because of trap (like other tests)
    expect(st.registers[7]).toBe(OK);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);

    // staged yield lives in accumulation session
    expect(env.acc.session.yield).toBeDefined();
    expect(Buffer.from(env.acc.session.yield!)).toEqual(Buffer.from(H));
  });

  it("unmapped pointer -> Panic; no session change", () => {
    const env = makeHostEnv();
    const blob = makeBlob(prog(0x20), bitmask); // below 64KiB

    const st = runBlob(blob, GAS, { env, memInit: new Uint8Array(1<<20) });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(env.acc.session.yield).toBeUndefined(); // should not have written anything to session on failure
  });

  it("second yield overwrites previous value", () => {
    const env = makeHostEnv();

    const H1 = new Uint8Array(HASH_BYTES).fill(0xaa);
    const H2 = new Uint8Array(HASH_BYTES).map((_, i) => (i * 7) & 0xff);

    const mem = new Uint8Array(1<<20);
    mem.set(H1, HEAP);

    // first call
    let st = runBlob(makeBlob(prog(HEAP), bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(OK);
    expect(Buffer.from(env.acc.session.yield!)).toEqual(Buffer.from(H1));

    // second call with different 32B hash
    const HEAP2 = HEAP + 0x100;
    mem.set(H2, HEAP2);
    st = runBlob(makeBlob(prog(HEAP2), bitmask), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(OK);
    expect(Buffer.from(env.acc.session.yield!)).toEqual(Buffer.from(H2));
  });
});
