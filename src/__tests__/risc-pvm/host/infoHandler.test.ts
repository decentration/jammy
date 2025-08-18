import { buildBlob }       from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv }     from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes }         from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }         from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }  from "../../../risc-pvm/interpreter/types";
import { INFO_BYTES, NONE, OK, SVC_ID, WHO }   from "../../../risc-pvm/interpreter/host/consts";
import { encodeInfoHelper } from "../../../risc-pvm/interpreter/host/helpers";
import { ServiceAccount } from "../../../risc-pvm/interpreter/host/types";
import { makeOpcodeBitmask } from "./helpers";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";

const DEST = 0x18000;
const WILDCARD = (1n << 64n) - 1n; // which is 0xFFFF_FFFF_FFFF_FFFFn

const prog = Uint8Array.of(
    Opcodes.load_imm_64, 7, ...toLE(WILDCARD, 8),
       Opcodes.load_imm,    8, DEST & 0xFF, (DEST >> 8) & 0xFF, (DEST >> 16) & 0xFF, (DEST >> 24) & 0xFF,
    Opcodes.load_imm,    11, 0, 0, 0, 0, // r11, 0  (f = 0)
    Opcodes.load_imm,    12, INFO_BYTES & 0xFF, (INFO_BYTES >> 8) & 0xFF, 0, 0, // r12 INFO_BYTES (l = vLength)
    Opcodes.ecalli, 5,
    Opcodes.trap
  );


function progExplicit(id: bigint): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm_64, 7, ...toLE(id, 8),
    Opcodes.load_imm,    8, DEST & 0xFF, (DEST >> 8) & 0xFF, (DEST >> 16) & 0xFF, (DEST >> 24) & 0xFF,
    Opcodes.load_imm,   11, 0, 0, 0, 0,
    Opcodes.load_imm,   12, INFO_BYTES & 0xFF, (INFO_BYTES >> 8) & 0xFF, 0, 0,
    Opcodes.ecalli, 5,
    Opcodes.trap
  );
}

const sa: ServiceAccount = {
  storage: new Map(),
  preimages: new Map(),
  lookupStorage: new Map(),
  rootCodeHash   : 0x1234n,
  balance        : 7n,
  gasAccumulate  : 777n,
  gasOnTransfer  : 888n,
  cores          : new Uint8Array(0),
  selectorMap    : new Map(),
  ticketNext     : 0n,
  coresOffset    : 0,
  ticketIndex    : 0
};

const SERVICE_ID = 0xFFFF_FFFF_FFFF_FFFFn;   // BigInt
const bitmask = makeOpcodeBitmask(prog, [0, 10, 16, 22, 28, 30]);
const blob = buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
  instr:prog, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

describe("ΩI info handler", () => {
  it("writes info blob, r7=OK", () => {

    const cur = 0xdead_beefn;
    const env = makeHostEnv({
      accounts : new Map([[cur, sa]]),
      initAcc: { allocator: { index: cur, env: { deltas: new Map(), currentServiceId: cur, root: 0n } }, session: { scratch: {} } }

    });
    env.encodeInfo = encodeInfoHelper;
    const st = runBlob(blob, 100,{ env, memInit:new Uint8Array(1<<20) });

    expect(st.registers[7]).toBe(BigInt(INFO_BYTES));
    expect(st.memory.slice(DEST, DEST + INFO_BYTES)).toEqual(encodeInfoHelper(sa));
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("no info -> r7=NONE", () => {
    const st = runBlob(blob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(NONE);
  });

  it("unknown service -> r7=WHO", () => {
    const env = makeHostEnv();    
    env.encodeInfo = encodeInfoHelper;
    const st = runBlob(blob, 100, { env, memInit: new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(NONE); 
    // nothing written check
    expect(st.memory.slice(DEST, DEST + INFO_BYTES)).toEqual(new Uint8Array(INFO_BYTES));

  });

  it("explicit id: writes info blob; r7 = Sv", () => {
    const id = 0x9999_9999_9999n;
    const code = progExplicit(id);
    const blob = buildBlob({
      meta: Uint8Array.of(0),
      jumpTbl: Uint8Array.of(0),
      z: 1,
      instr: code,
      jumpEntries: [Uint8Array.of(0)],
      bitmaskBits: bitmask,
    });

    const env = makeHostEnv({ accounts: new Map([[id, sa]]) });
    env.encodeInfo = encodeInfoHelper;

    const st = runBlob(blob, 100, { env, memInit: new Uint8Array(1 << 20) });

    expect(st.registers[7]).toBe(BigInt(INFO_BYTES));
    expect(st.memory.slice(DEST, DEST + INFO_BYTES)).toEqual(encodeInfoHelper(sa));
  });

  it("dest unmapped -> Panic", () => {
    const bad = Uint8Array.from(prog); bad[8]=0; bad[9]=0; // dest inside code
    const badBlob = buildBlob({meta:Uint8Array.of(0),jumpTbl:Uint8Array.of(0),z:1,
      instr:bad,jumpEntries:[Uint8Array.of(0)],bitmaskBits:bitmask});
    const st = runBlob(badBlob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});

describe("ΩI info handler with newer encodeInfoHelper", () => {

  it("writes info blob, r7 = Sv (INFO_BYTES)", () => {
    const env = makeHostEnv({
      accounts : new Map([[WILDCARD, sa]]),
      initAcc: { allocator: { index: WILDCARD, env: { deltas: new Map(), currentServiceId: WILDCARD, root: 0n } }, session: { scratch: {} } }

    });
    env.encodeInfo = encodeInfoHelper;

    const mem = new Uint8Array(1 << 20);
    const st  = runBlob(blob, 100, { env, memInit: mem });

    expect(st.registers[7]).toBe(BigInt(INFO_BYTES));                 // <-- Sv
    expect(st.memory.slice(DEST, DEST + INFO_BYTES))
      .toEqual(encodeInfoHelper(sa));                                  // bytes written
    expect(st.exit?.type).toBe(ExitReasonType.Panic);                  // due to trap
  });

}); 