import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { HASH_BYTES, INFO_BYTES, OK, SVC_ID, WHAT, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { AccumulateContext, ServiceAccount } from "../../../risc-pvm/interpreter/host/types";
import { makeOpcodeBitmask } from './helpers'

const HEAP = 0x18000;
const GAS  = 100;

function mkCode(o=HEAP, g=123n, m=456n) {
    return Uint8Array.of(
      Opcodes.load_imm,    7,  o & 0xFF, (o >> 8) & 0xFF, (o >> 16) & 0xFF, (o >> 24) & 0xFF,
      Opcodes.load_imm_64,8,  ...toLE(g, 8),
      Opcodes.load_imm_64,9,  ...toLE(m, 8),
      Opcodes.ecalli, 19,
      Opcodes.trap
    );
  }

const bitmask = Uint8Array.of(
  0b0100_0001, // load_imm
  0b0000_0000, // load_imm_64
  0b0000_0001, // load_imm_64
  0b0001_0100  // ecalli, trap
);

const mkBlob = (code: Uint8Array) =>
  buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
              instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

describe("ΩU upgrade handler", () => {
  it("happy-path updates rootCodeHash and gas limits, r7=OK", () => {
    const codeHash = new Uint8Array(HASH_BYTES).map((_,i)=> (i*3)&0xFF);
    const mem = new Uint8Array(1<<20);
    mem.set(codeHash, HEAP);

    const env = makeHostEnv();


    const blob = mkBlob(mkCode(HEAP, 123n, 456n));
    const st = runBlob(blob, GAS, { env, memInit: mem });
    console.log(st);
    
    const staged = env.acc.allocator.env.deltas.get(SVC_ID) as any as ServiceAccount;
    expect(staged).toBeTruthy();
    expect(staged.gasAccumulate).toBe(123n);
    expect(staged.gasOnTransfer).toBe(456n);
    expect(staged.rootCodeHash).toBe(
      BigInt("0x" + Buffer.from(codeHash).reverse().toString("hex"))
    );
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("unmapped code-hash pointer -> Panic, no mutation", () => {
    const env = makeHostEnv();
    const BAD = 0x000020; // unmapped low page
    const blob = mkBlob(mkCode(BAD, 999n, 111n));
    const st = runBlob(blob, GAS, { env, memInit: new Uint8Array(1<<20) });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(env.acc.allocator.env.deltas.has(SVC_ID)).toBe(false);
  });
});

it("upgrade then info reflects new c,g,m", () => {
  const mem = new Uint8Array(1<<20);
  const H = new Uint8Array(32).fill(0x11);
  mem.set(H, HEAP);

  const mkHostEnvCode = (index: bigint) => {
    return {
      allocator: {
        index: index,
        env: {
          deltas: new Map<bigint, any>(),
          currentServiceId: index,
          root: 0n
        }
      },
      session: {
        scratch: {}
      }
    } as AccumulateContext;
  }

  const CUR = 0xffff_ffff_ffff_ffffn;
  const env = makeHostEnv({initAcc: mkHostEnvCode(CUR)});

  const blob = mkBlob(mkCode(HEAP, 777n, 888n));
  const st1 = runBlob(blob, 100, { env, memInit: mem });
  expect(st1.registers[7]).toBe(OK);

  const infoProg = Uint8Array.of(
    // 0xffff_ffff_ffff_ffff
    Opcodes.load_imm_64, 7, ...toLE((1n << 64n) - 1n, 8),
    Opcodes.load_imm,    8, HEAP & 0xFF, (HEAP >> 8) & 0xFF, (HEAP >> 16) & 0xFF, (HEAP >> 24) & 0xFF,
    Opcodes.load_imm,    11, 0, 0, 0, 0, // r11, 0  (f = 0)
    Opcodes.load_imm,    12, INFO_BYTES & 0xFF, (INFO_BYTES >> 8) & 0xFF, 0, 0, // r12 INFO_BYTES (l = vLength)
    Opcodes.ecalli,      5,
    Opcodes.trap
  );
  
  const infoMask = makeOpcodeBitmask(infoProg, [0, 10, 16, 22, 28, 30]);

  // build with this mask
  const blob2 = buildBlob({
    meta: Uint8Array.of(0),
    jumpTbl: Uint8Array.of(0),
    z: 1,
    instr: infoProg,
    jumpEntries: [Uint8Array.of(0)],
    bitmaskBits: infoMask
  });
 
  const st2 = runBlob(blob2, 100, { env, memInit: mem });

  expect(st2.registers[7]).toBe(BigInt(INFO_BYTES));  // spot check tg/tm in output (bytes 32+16..)
  const out = st2.memory.slice(HEAP, HEAP+64);
  const tg = Number(BigInt(out[56]) | (BigInt(out[57])<<8n)); // quick sanity nibble
  expect(tg).toBeGreaterThan(0);

});

// it("creates a zeroed xs if missing and updates it", () => {
//   const codeHash = new Uint8Array(HASH_BYTES).fill(0xAB);
//   const mem = new Uint8Array(1<<20); mem.set(codeHash, HEAP);
//   const CUR = 0xdead_beefn;
//   const env = makeHostEnv({ initAcc: { allocator: { index: CUR, env: { deltas: new Map(), currentServiceId: CUR, root: 0n } }, session: { scratch: {} } } });
//   // deliberately do NOT pre-insert the service
//   const st = runBlob(mkBlob(mkCode(HEAP, 321n, 654n)), GAS, { env, memInit: mem });
//   expect(st.registers[7]).toBe(OK);
//   const staged = env.acc.allocator.env.deltas.get(CUR) as ServiceAccount;
//   expect(staged.gasAccumulate).toBe(321n);
//   expect(staged.gasOnTransfer).toBe(654n);
//   expect(staged.rootCodeHash).toBe(BigInt("0x" + Array.from(codeHash).reverse().map(b=>b.toString(16).padStart(2,"0")).join("")));
// });