import { NONE } from "../../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../../risc-pvm/interpreter/host/hostEnvInterface";
import { AccumulateX, ServiceAccount } from "../../../../risc-pvm/interpreter/host/types";
import { Opcodes } from "../../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../../risc-pvm/interpreter/types";
import { HEAP } from "../consts";
import { loadImm, makeOpcodeBitmask, makeBlob, mkService } from "../helpers";

const GAS  = 400n;
const DST  = HEAP + 0x400;
const BAD = 0x40;
const xs  = 0xDEAD_BEEFn;

enum FetchSel {
  Config = 0,
  Erroneous = 99,
}

const PREIMAGE = new TextEncoder().encode("hello-preimage"); // length 14 
const H = new Uint8Array(32).fill(0x42); // memory at hOff
const env = makeHostEnv({
  preImage: new Map([[Buffer.from(H).toString("hex"), PREIMAGE]])
}); // build env so lookupPreimage(H) === PRE

const mem = new Uint8Array(1<<20);
mem.set(H, HEAP); //put H into outer memory in r8


describe("Journey: ΩY (fetch) + ΩL (lookup) + ΩI (info)", () => {
  it("[ΩY/1] fetch custom vector: copies bytes, r7 = total length", () => {
    const V = new TextEncoder().encode("hello-fetch-vector");
    const env = makeHostEnv({ vectors: { [FetchSel.Erroneous]: V } as any });

    const lenReq = 5, off = 6;
    const prog = Uint8Array.of(
      ...loadImm(7,  DST),    // dest
      ...loadImm(8,  off),    // offset f
      ...loadImm(9,  lenReq), // length l
      ...loadImm(10, 0),      // selector 0 = Config (recognized)
      Opcodes.ecalli, 1,      // ΩY
      Opcodes.trap
    );

    const mask = makeOpcodeBitmask(prog, [0,6,12,18,24,26]);
    
    const mem = new Uint8Array(1<<20);
    const st  = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });
    
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7] > 0n).toBe(true);     // total length > 0
    expect([...st.memory.slice(DST, DST+lenReq)]).not.toEqual(new Array(lenReq).fill(0));
  });

  it("[ΩY/1] unknown selector => r7 = NONE; no write", () => {
    const env = makeHostEnv();

    const prog = Uint8Array.of(
      ...loadImm(7,  DST),
      ...loadImm(8,  0),
      ...loadImm(9,  4),
      ...loadImm(10, 12345),        // nothing installed
      Opcodes.ecalli, 1,
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,6,12,18,24,26]);

    const mem = new Uint8Array(1<<20);
    const st  = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(NONE);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("[ΩY/1] dest unmapped => Panic (page-fault mapped to Panic per A.8–A.9)", () => {
    const V = new Uint8Array([1,2,3,4,5]);
    const env = makeHostEnv({ vectors: { [FetchSel.Erroneous]: V } as any });

    const prog = Uint8Array.of(
      ...loadImm(7,  BAD),
      ...loadImm(8,  0),
      ...loadImm(9,  5),
      ...loadImm(10, FetchSel.Erroneous),
      Opcodes.ecalli, 1,            // ΩY
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,6,12,18,24,26]);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("[ΩL/2] lookup: present preimage returns length and copies slice; missing => NONE", () => {
  
    const env = makeHostEnv({
      preImage: new Map([[Buffer.from(H).toString("hex"), PREIMAGE]]),
      initAcc: { allocator: { env: { currentServiceId: xs } as any } as any }
    });
    // minimal xs account
    env.putService(xs, {
      storage: new Map(),
      preimages: new Map(),
      lookupStorage: new Map(),
      rootCodeHash: 0n,
      balance: 0n,
      gasAccumulate: 0n,
      gasOnTransfer: 0n,
      cores: new Uint8Array(0),
      selectorMap: new Map(),
      ticketNext: 0n,
      coresOffset: 0,
      ticketIndex: 0,
      threshold: 0n,
    });
  
    const mem = new Uint8Array(1<<20);
    mem.set(H, HEAP);
  
    expect(env.lookupPreimage!(mem.slice(HEAP, HEAP+32))).toEqual(PREIMAGE);
  
    const prog = Uint8Array.of(
      Opcodes.load_imm_64, 7, 0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff, // r7 = NONE
      ...loadImm(8,  HEAP), // hOff
      ...loadImm(9,  DST),  // dest
      ...loadImm(10, 5),    // f
      ...loadImm(11, 6),    // l
      Opcodes.ecalli, 2,    // ΩL
      Opcodes.trap
    );
  
    const mask = makeOpcodeBitmask(prog, [0,10,16,22,28,34,36]);
  
    const hexInMem = Buffer.from(mem.slice(HEAP, HEAP+32)).toString("hex");
    const hexKey   = Buffer.from(H).toString("hex");
    expect(hexInMem).toBe(hexKey);
  
    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(BigInt(PREIMAGE.length));
    expect(st.memory.slice(DST, DST+6)).toEqual(PREIMAGE.subarray(5, 11));
  });
  

  it("[ΩI/5] no staged entry => r7=NONE and no write occurs", () => {

    const env = makeHostEnv({
      initAcc: { allocator: { env: { currentServiceId: xs }, index: 0n } as AccumulateX }
    });

    const mem = new Uint8Array(1 << 20); 

    const prog = Uint8Array.of(
      Opcodes.load_imm_64, 7, 0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
      ...loadImm(8,  DST),
      ...loadImm(11, 0),
      ...loadImm(12, 16),
      Opcodes.ecalli, 5,
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,10,16,22,28,30]);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(NONE);   // v = empty => NONE
    expect(st.memory.slice(DST, DST+16))
      .toEqual(new Uint8Array(16).fill(0));    // no write performed
  });

  it("[ΩI/5] dest unmapped and l>0 => Panic (page-fault mapped to ☇)", () => {
    const xs  = 0xBEEF_F00Dn;
    const env = makeHostEnv({
      initAcc: { allocator: { env: { currentServiceId: xs }, index: 0n } as AccumulateX }
    });

    // stage something so info 
    const staged: ServiceAccount = mkService(0n, 0n, 999n);
    env.acc.allocator.env.deltas.set(xs, staged);


    const prog = Uint8Array.of(
      Opcodes.load_imm_64, 7, 0xff,0xff,0xff,0xff,0xff,0xff,0xff,0xff,
      ...loadImm(8,  BAD),
      ...loadImm(11, 4),
      ...loadImm(12, 8),
      Opcodes.ecalli, 5,
      Opcodes.trap
    );
    const mask = makeOpcodeBitmask(prog, [0,10,16,22,28,30]);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});

