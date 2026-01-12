import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { NONE, WHAT } from "../../../risc-pvm/interpreter/host/consts";
import { buildFetchConfigVector } from "../../../risc-pvm/interpreter/host/helpers";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { FetchSel, fetchVecSelectorMap } from "../../../risc-pvm/interpreter/host/types";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";

const GAS = 100n;
// Helper that builds a tiny program:  r10<-sel ; ecalli 18 ; trap
const HEAP_START = 0x10000;
function makeCode(sel: number, dest = HEAP_START): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7,
    dest & 0xFF,
    (dest >> 8) & 0xFF,
    (dest >> 16) & 0xFF,
    (dest >> 24) & 0xFF,
    Opcodes.load_imm, 10, sel, 0, 0, 0, // ω10 = selector
    Opcodes.ecalli, 1,
    Opcodes.trap
  );
}
// b
const makeBlob = (code: Uint8Array, bitmask: Uint8Array) => {
  return buildBlob({
    meta: Uint8Array.of(0),
    z: 1,
    instr: code,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: bitmask,
  });
};

const bitmask = Uint8Array.of(0b0100_0001, 0b0101_0000);   // imm, ecalli, trap

describe("ΩY fetch handler", () => {

  it("selector 0 (config): writes config vector & sets r7=bytesWritten and r8=vLength", () => {
    const env = makeHostEnv();
    const code = makeCode(FetchSel.Config);
    const blob = makeBlob(code, bitmask);
    const st = runBlob(blob, GAS, { env, memInit: new Uint8Array(1 << 20), strictVm: false });
    const cfg = buildFetchConfigVector();

    expect(st.registers[7]).toBe(BigInt(cfg.length));
    expect(st.registers[8]).toBe(BigInt(cfg.length));
    expect(st.memory.slice(HEAP_START, HEAP_START + cfg.length)).toEqual(cfg);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("happy‑path: copies bytes & sets r7=bytesWritten and r8=vLength", () => {
    const env = makeHostEnv();
    const code = makeCode(FetchSel.Config);
    const blob = makeBlob(code, bitmask);
    const st = runBlob(blob, GAS, { env, strictVm: false });

    const cfg = buildFetchConfigVector();
    expect(st.registers[7]).toBe(BigInt(cfg.length));
    expect(st.registers[8]).toBe(BigInt(cfg.length));
    expect(st.memory.slice(HEAP_START, HEAP_START + cfg.length)).toEqual(cfg);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("config vector: copies bytes & sets r7=bytesWritten and r8=vLength", () => {
    const env = makeHostEnv();
    const code = makeCode(FetchSel.Config);
    const blob = makeBlob(code, bitmask);
    const st = runBlob(blob, GAS, { env, strictVm: false });

    const cfg = buildFetchConfigVector();
    expect(st.registers[7]).toBe(BigInt(cfg.length));
    expect(st.registers[8]).toBe(BigInt(cfg.length));
    expect(st.memory.slice(HEAP_START, HEAP_START + cfg.length)).toEqual(cfg);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  // Selector 8 (ProgMeta) now returns config blob instead of E(pu, pp)
  it("v0.7.2 GP #486: selector 8 (ProgMeta) returns config vector", () => {
    const env = makeHostEnv();
    const code = makeCode(FetchSel.ProgMeta);
    const blob = makeBlob(code, bitmask);
    const st = runBlob(blob, GAS, { env, strictVm: false });

    const cfg = buildFetchConfigVector();
    // r7 should be bytes written (config length)
    expect(st.registers[7]).toBe(BigInt(cfg.length));
    // Memory should contain the config vector
    expect(st.memory.slice(HEAP_START, HEAP_START + cfg.length)).toEqual(cfg);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("code-blob vector: copies bytes & sets r7=bytesWritten and r8=vLength", () => {
    const V = Uint8Array.from([1, 2, 3, 4, 5]);
    const env = makeHostEnv({ vectors: { programBlob: V } });
    const code = makeCode(FetchSel.ProgSerialized);
    const blob = makeBlob(code, bitmask);

    console.log("selector=", 7, "mapsTo=", fetchVecSelectorMap[7]);
    console.log("env vectors keys=", Object.keys((env as any).vectors ?? {}));
    const st = runBlob(blob, GAS, { env, strictVm: false });

    console.log("st", st);

    expect(st.registers[7]).toBe(BigInt(V.length));
    expect(st.registers[8]).toBe(BigInt(V.length));
    expect(st.memory.slice(HEAP_START, HEAP_START + V.length)).toEqual(V);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });


  it("vector missing -> r7=NONE", () => {
    const env = makeHostEnv();  // empty
    const blob = makeBlob(makeCode(FetchSel.ProgSerialized), bitmask);
    const st = runBlob(blob, 50n, { env, strictVm: false });

    console.log("st", st);
    expect(st.registers[7]).toBe(NONE);
  });

  it("unknown selector → r7=NONE", () => {
    const env = makeHostEnv();
    const blob = makeBlob(makeCode(99), bitmask); // 99 is not a valid selector
    const st = runBlob(blob, 50n, { env, strictVm: false });

    expect(st.registers[7]).toBe(NONE);
  });

  it("write into read‑only page -> Panic", () => {
    const vec = Uint8Array.of(9, 9, 9);
    const env = makeHostEnv({ vectors: { programBlob: vec } });
    const UNMAPPED = 0x00000;
    const blob = makeBlob(makeCode(FetchSel.ProgSerialized, UNMAPPED), bitmask);
    const st = runBlob(blob, GAS, { env, strictVm: false });


    // loop through and check that the memory is still zero
    expect(Array.from(st.memory.slice(UNMAPPED, UNMAPPED + vec.length)).every(b => b === 0)).toBe(true);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.gas).toBe(100n - 10n - 1n - 1n - 1n);
  });

});
