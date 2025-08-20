import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { C, CORE, CORES_SIZE, HUH, OK, Q, WHO } from "../../../risc-pvm/interpreter/host/consts";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { AccEnv, AccumulateContext, ServiceAccount, ServiceId } from "../../../risc-pvm/interpreter/host/types";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { makeOpcodeBitmask } from "./helpers";

const HEAP = 0x18000;
const GAS  = 100;

function makeCode(idx = 0, o = HEAP, a: bigint = 0x1111n) {
  return Uint8Array.of(
    Opcodes.load_imm,    7, idx & 0xFF, (idx >>> 8) & 0xFF, 0, 0,         // r7 <- c
    Opcodes.load_imm,    8, o & 0xFF, (o >>> 8) & 0xFF, (o >>> 16) & 0xFF, (o >>> 24) & 0xFF, // r8 <- o
    Opcodes.load_imm_64, 9, ...toLE(a, 8),                             // r9 <- a
    Opcodes.ecalli, 15,
    Opcodes.trap
  );
}
function makeBlob(code: Uint8Array): Uint8Array {

  const mask = makeOpcodeBitmask(code, [0, 6, 12, 22 , 24]);

    return buildBlob({
      meta: Uint8Array.of(0), jumpTbl: Uint8Array.of(0), z:1,
      instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask
    });
  }

  function makeService(balance: bigint = 0n): ServiceAccount {
    return {
      storage: new Map(),
      preimages: new Map(),
      lookupStorage: new Map(),
      rootCodeHash: 0n,
      balance,
      gasAccumulate: 0n,
      gasOnTransfer: 0n,
      cores: new Uint8Array(0),
      selectorMap: new Map(),
    };
  }
  

  function makeAcc(currentServiceId: ServiceId): AccumulateContext {
    return {
      allocator: {
        index: currentServiceId,
        env: {
          deltas: new Map<bigint, any>(),
          currentServiceId: currentServiceId,
          root: 0n,
        },
      },
      session: { scratch: {} },
    };
  }

describe("ΩA assign handler", () => {
  it("happy‑path -> OK", () => {

    const idx = 2;        // core index
    const o = HEAP;       // pointer to q
    const a = 0x2222n;    // target owner id (must exist)
    const currentServiceId = 0xAAAAn;  // xs

    // prepaer memory
    const qBytes = new Uint8Array(CORES_SIZE).map((_, i) => (i * 7) & 0xff);
    const mem = new Uint8Array(1 << 20);
    mem.set(qBytes, HEAP);

    const env = makeHostEnv({
      accounts: new Map<bigint, ServiceAccount>([
        [a, makeService()],   // target owner exists
       
      ]),
      initAcc: makeAcc(currentServiceId),
    });
    const st  = runBlob(makeBlob(makeCode(idx, o, a)), GAS, { env, memInit: mem });


    expect(st.registers[7]).toBe(OK);
   
    const xe = env.acc.allocator.env as AccEnv;
    expect(xe.assignServiceAccount?.get(idx)).toBe(a);
    expect(xe.assignCore?.get(idx)).toEqual(qBytes);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("index ≥ C -> r7=CORE (no mutation)", () => {
    const c = C;          // out-of-range (>= C)
    const o = HEAP;
    const a = 0x3333n;
    const currentServiceId = 0xBBBBn; // xs

    // provide readable q to avoid Panic and hit CORE branch
    const mem = new Uint8Array(1 << 20);
    mem.set(new Uint8Array(CORES_SIZE).fill(0x5a), HEAP);

    const env = makeHostEnv({
      accounts: new Map<bigint, ServiceAccount>([[a, makeService()], [currentServiceId, makeService()]]),
      initAcc: makeAcc(currentServiceId),
    });

    const st = runBlob(makeBlob(makeCode(c, o, a)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(CORE);
    const xe = env.acc.allocator.env as AccEnv;
    expect(xe.assignServiceAccount?.has(c)).toBeFalsy();
    expect(xe.assignCore?.has(c)).toBeFalsy();
  });

  it("unreadable q -> Panic", () => {
    const c = 0;
    const BAD = 0x000020;  // low unmapped page -> immediate Panic on write/read
    const a = 0x4444n;
    const currentServiceId = 0xCCCCn;

    const env = makeHostEnv({
      accounts: new Map<bigint, ServiceAccount>([[a, makeService()], [currentServiceId, makeService()]]),
      initAcc: makeAcc(currentServiceId),
    });

    const st = runBlob(makeBlob(makeCode(c, BAD, a)), GAS, { env, memInit: new Uint8Array(1 << 20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    const xe = env.acc.allocator.env as AccEnv;
    expect(xe.assignServiceAccount?.has(c)).toBeFalsy();
    expect(xe.assignCore?.has(c)).toBeFalsy();
  });


  it("HUH when core already has a different owner than xs", () => {
    const c = 1;
    const o = HEAP;
    const a = 0x5555n;       // target owner we’re trying to set
    const ownerOld = 0xDADAn; // existing owner of c (!= xs)
    const currentServiceId = 0xEEEEn;       // caller

    // readable q
    const mem = new Uint8Array(1 << 20);
    const qBytes = new Uint8Array(CORES_SIZE).fill(0x11);
    mem.set(qBytes, HEAP);

    const env = makeHostEnv({
      accounts: new Map<bigint, ServiceAccount>([
        [a, makeService()], [ownerOld, makeService()], [currentServiceId, makeService()],
      ]),
      initAcc: makeAcc(currentServiceId),
    });

    // seed prior ownership to someone else
    (env.acc.allocator.env as AccEnv).assignServiceAccount = new Map<number, bigint>([[c, ownerOld]]);
    (env.acc.allocator.env as AccEnv).assignCore = new Map<number, Uint8Array>();

    const st = runBlob(makeBlob(makeCode(c, o, a)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(HUH);
    // should remain unchanged
    const xe = env.acc.allocator.env as AccEnv;
    expect(xe.assignServiceAccount!.get(c)).toBe(ownerOld);
    expect(xe.assignCore!.has(c)).toBe(false);
  });

  it("WHO when target service id `a` is unknown", () => {
    const c = 0;
    const o = HEAP;
    const a = 0x9999n; // not present in env accounts
    const currentServiceId = 0xFEEDn;

    const mem = new Uint8Array(1 << 20);
    mem.set(new Uint8Array(CORES_SIZE).fill(0x22), HEAP);

    const env = makeHostEnv({
      accounts: new Map<bigint, ServiceAccount>([[currentServiceId, makeService()]]), // only xs exists
      initAcc: makeAcc(currentServiceId),
    });

    const st = runBlob(makeBlob(makeCode(c, o, a)), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(WHO);
    const xe = env.acc.allocator.env as AccEnv;
    expect(xe.assignServiceAccount?.has(c)).toBeFalsy();
    expect(xe.assignCore?.has(c)).toBeFalsy();
  });
}); 