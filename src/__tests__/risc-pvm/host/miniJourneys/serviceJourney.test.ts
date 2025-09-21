import {  makeHostEnv } from "../../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../../risc-pvm/interpreter/types";
import { WHO, NONE, CASH } from "../../../../risc-pvm/interpreter/host/consts";
import { loadImm, makeBlob, makeOpcodeBitmask, mkService } from "../helpers";
import { AccumulateX, ServiceAccount } from "../../../../risc-pvm/interpreter/host/types";

const GAS  = 500;
const HEAP = 0x18000;         // safe mapped outer memory
const KOFF = HEAP + 0x100;    // key bytes start
const VOFF = HEAP + 0x200;    // value bytes start
const OUT  = HEAP + 0x300;    // read-out dest

describe("Journey 1: ΩN -> ΩW -> ΩR -> ΩI", () => {
  const mem = new Uint8Array(1 << 20);
  const CODE_HASH = new Uint8Array(32).fill(0xAB);
  mem.set(CODE_HASH, HEAP);

  const KEY   = new TextEncoder().encode("foo");
  const VALUE = new TextEncoder().encode("bar-baz");
  mem.set(KEY,  KOFF);
  mem.set(VALUE, VOFF);

  // payer xs
  const xs = 0x1111_2222_3333_4444n;
  const activationFee = 10n;
  // env with payer + plenty of balance + threshold=0
  const env = makeHostEnv({
    activationFee,
    initAcc: {
      allocator: { env: { currentServiceId: xs }, index: 0n } as AccumulateX
    }
  });

  // Seed payer account
  const service = mkService(0n, 0n, 1000n);
  env.putService(xs, service);

  it("[Step 1: ΩN/18] creates a new service under payer xs -> r7=newId", () => {
   
    const progNew = Uint8Array.of(
      ...loadImm(7,  HEAP),        // o = heap r7
      ...loadImm(8,  1),           // l = 1 r8
      ...loadImm(9,  0),           // g = 0  r9
      ...loadImm(10, 0),           // m = 0 r10
      ...loadImm(11, 0),           // f = 0 (not privileged) r11
      ...loadImm(12, 0xFFFF_FFFF), // i (non-root/non-explicit) r12
      Opcodes.ecalli, 18,          // ΩN
      Opcodes.trap
    );

    const maskNew = makeOpcodeBitmask(progNew, [0, 6, 12, 18, 24, 30, 36, 38])
    const stN = runBlob(makeBlob(progNew, maskNew), GAS, { env, memInit: mem });
    expect(stN.exit?.type).toBe(ExitReasonType.Panic);

    const newId = stN.registers[7];
    expect(newId).not.toBe(WHO);
    // ensure threshold gate and debit passed; and env state carries staged account.
    const staged = env.acc.allocator.env.deltas.get(newId) as ServiceAccount | undefined;
    expect(staged).toBeTruthy();
  });

  it("[Step 2: ΩW/4] writes key/value under new service -> r7=NONE (no previous)", () => {
    const progW = Uint8Array.of(
      ...loadImm(7,  KOFF),         // key offset 
      ...loadImm(8,  KEY.length),   // key length
      ...loadImm(9, VOFF),          // value offset
      ...loadImm(10, VALUE.length), // value length
      Opcodes.ecalli, 4,            // ΩW
      Opcodes.trap
    );

    const maskW = makeOpcodeBitmask(progW, [0, 6, 12, 18, 24, 26])
    const stW = runBlob(makeBlob(progW, maskW), GAS, { env, memInit: mem });
    expect(stW.exit?.type).toBe(ExitReasonType.Panic);
    // First put => r7 = NONE (no previous)
    expect(stW.registers[7]).toBe(NONE);
  });

  it("[Step 3: ΩR/3] reads back the value just written -> r7=value length", () => {
    const progR = Uint8Array.of(
      ...[Opcodes.load_imm_64], 7, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // r7 = NONE
      ...loadImm(8,  KOFF),            // key offset
      ...loadImm(9,  KEY.length),      // key length
      ...loadImm(10, OUT),             // dest
      ...loadImm(11, 0),               // f = 0
      ...loadImm(12, VALUE.length),    // l = VALUE.len
      Opcodes.ecalli, 3,               // ΩR
      Opcodes.trap
    );

    const maskR = makeOpcodeBitmask(progR, [0, 10, 16, 22, 28, 34, 40, 42])
    const stR = runBlob(makeBlob(progR, maskR), GAS, { env, memInit: mem });

    expect(stR.exit?.type).toBe(ExitReasonType.Panic);
    expect(stR.registers[7]).toBe(BigInt(VALUE.length));
    expect(stR.memory.slice(OUT, OUT + VALUE.length)).toEqual(VALUE);

    console.log(">>> read value:", new TextDecoder().decode(stR.memory.slice(OUT, OUT + VALUE.length)));
  });

  it("[Step 4: ΩI/5] tries to info-read with insufficient buffer -> PANIC (r7=needed)", () => {
    const progI = Uint8Array.of(
      ...[Opcodes.load_imm_64], 7, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, // NONE => xs
      ...loadImm(8,  OUT),          // dest
      ...loadImm(11, 32),           // f
      ...loadImm(12, 16),           // l
      Opcodes.ecalli, 5,            // ΩI
      Opcodes.trap
    );

    const maskI = makeOpcodeBitmask(progI, [0, 10, 16, 22, 28, 30])
    const stI = runBlob(makeBlob(progI, maskI), GAS, { env, memInit: mem });
    expect(stI.exit?.type).toBe(ExitReasonType.Panic);
    expect(stI.registers[7]).toBe(80n);
    expect(stI.memory.slice(OUT, OUT + 16)).not.toEqual(new Uint8Array(16).fill(0)); // looks non-zero
  });
});

describe("ΩN/18 threshold gate", () => {
  it("[ΩN/18] threshold gate: post-debit < threshold => CASH (no service created)", () => {
    const xs = 0xDEAD_BEEFn;
    const activationFee = 100n;

    const env = makeHostEnv({
      activationFee,
      initAcc: { allocator: { env: { currentServiceId: xs }, index: 0n } as AccumulateX }
    });
    
    // payer with just the activation fee and a threshold above post-debit
    const service = mkService(0n, 0n, activationFee, { threshold: 1n});
    env.putService(xs, service);

    const mem = new Uint8Array(1<<20);
    const codeHash = new Uint8Array(32).fill(0x11);
    mem.set(codeHash, HEAP);

    const prog = Uint8Array.of(
      ...loadImm(7, HEAP),       // o = heap r7
      ...loadImm(8, 1),          // l = 1 r8
      ...loadImm(9, 0),         // g = 0  r9
      ...loadImm(10, 0),  // m = 0 r10
      ...loadImm(11, 0),      // f = 0 (not privileged) r11
      ...loadImm(12, 0xFFFF_FFFF), // i (non-root/non-explicit) r12
      Opcodes.ecalli, 18, 
      Opcodes.trap
    );

    const maskProg = makeOpcodeBitmask(prog, [0, 6, 12, 18, 24, 30, 36, 38])

    const st = runBlob(makeBlob(prog, maskProg), GAS, { env, memInit: mem });
    expect(st.registers[7]).toBe(CASH);
  });
});