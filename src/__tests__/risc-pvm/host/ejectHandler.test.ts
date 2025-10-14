import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { OK, WHO, HUH, SVC_ID, HASH_BYTES, D } from "../../../risc-pvm/interpreter/host/consts";
import { DesignationEntry, EjectWitnessTuple, ServiceAccount, DESIGNATION_ROLE_EJECT, } from "../../../risc-pvm/interpreter/host/types";
import { le32, le32ToBigInt, le64, makeBlob, makePayer, mkService } from "./helpers";
import { toLE } from "../../../risc-pvm/interpreter/instructions/helpers";
import { ledgerPut } from "../../../risc-pvm/interpreter/host/handlers/accumulate/helpers";

const HEAP = 0x18000;
const NOW  = 1_000_000n;  // t
const BIG_ENOUGH_MEM = 1 << 20;
const GAS  = 100_000n;
const EJECT_DELAY = BigInt(D); // D = 19,200

function prog(d: bigint, o: number): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm_64, 7, ...le64(d),
    Opcodes.load_imm,    8, ...le32(o),
    Opcodes.ecalli, 21,
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0000_0001, 0b0000_0100, 0b0000_0101);


describe("ΩJ eject handler", () => {
    it("happy path -> OK (role=2, dc==E32(xs), witness present and y < t-D)", () => {
    const env = makeHostEnv({ accounts: new Map() }) as any;
    env.acc.allocator.env.currentServiceId = SVC_ID;
  
    // 32-byte seed in memory
    const h = new Uint8Array(32).map((_, i) => (i * 7) & 0xff);
    const codeHash = le32ToBigInt(h);
  
    // xs is payer
    const xs = mkService(SVC_ID, codeHash, 0n);
    env.putService(SVC_ID, xs);
  
    // d MUST have same code hash as xs for WHO gate to pass
    const dId = 42n;
    const d = mkService(dId, codeHash, 0n);
    d.lookupStorage ??= new Map();
    env.putService(dId, d);
    env.acc.allocator.env.deltas.set(dId, d);

  
    // designation entry: role=2, with an offset l, using 0 for simplicity
    env.acc.allocator.env.designationEntries = new Map<bigint, DesignationEntry>();
    env.acc.allocator.env.designationEntries.set(dId, {
      role: DESIGNATION_ROLE_EJECT,
      boundCodeHash32: new Uint8Array(32), // not used by handler, provided for completeness
      witnessBaseOffset: 0,
      witnessIndex: undefined,
    });
  
    // witness (h,l) is an element of d.l with tuple [x,y]; choose old y so y < t - D 
    const l = 0;
    const keyHex = Buffer.from(h).toString("hex");
    const y = 0n;    // long in past
    const x = 0n;
    const tuple = new Uint8Array(16);

    // make the tuple [x,y] LE
    tuple.set(toLE(x, 8), 0);
    tuple.set(toLE(y, 8), 8);

    const stagedD = env.acc.allocator.env.deltas.get(dId)!;
    ledgerPut(stagedD, keyHex, 0, mkWitness(0n, 1n));
  
    // make now much large so y < now - D holds regardless of D
    env.now = () => 10_000_000n;
  
    const bitmask = Uint8Array.of(0b0000_0001, 0b0000_0100, 0b0000_0101);

    // program and memory
    const blob = makeBlob(prog(dId, HEAP), bitmask);
    const mem  = new Uint8Array(1 << 20); 
    mem.set(h, HEAP);
  
    const st = runBlob(blob, GAS, { env, memInit: mem });
  
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(OK);
  });

  it("panic when 32B hash unreadable", () => {
    const xsId = SVC_ID;
    const env = makeHostEnv({
      now: NOW,
      accounts: new Map([
        [xsId, makePayer(xsId, 0n, 0n)],
        [1n,   makePayer(1n, 0n, 0n, 81)], // d with coresOffset=81 
      ]),
      initAcc: { allocator: { env: { currentServiceId: xsId, designationEntries: new Map() } } } as any,
    });

    const xe = env.acc.allocator.env as any;

    if (!xe.designationEntries) xe.designationEntries = new Map<bigint, DesignationEntry>();

    const bitmask = Uint8Array.of(0b0000_0001, 0b0000_0100, 0b0000_0101);
    const st = runBlob(makeBlob(prog(1n, 0x20), bitmask), GAS, { env, memInit: new Uint8Array(BIG_ENOUGH_MEM) },);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("WHO when dest is payer (d == xs) or entry missing or dc != E32(xs)", () => {
    const xsId = 0xAAAn; 
    const payer = makePayer(xsId, 0n, 0n); // payer is xs;
    // set E32(xs) to some H1; provide a different H2 in memory to force mismatch
    const H1 = new Uint8Array(32).fill(0x42);
    let root = 0n; 
    root = le32ToBigInt(H1); // E32(xs) = H1

    payer.rootCodeHash = root;

    const env = makeHostEnv({
      now: NOW,
      accounts: new Map([[xsId, payer]]),
      initAcc: { allocator: { env: { currentServiceId: xsId, designationEntries: new Map() } } } as any,
    });

    const xe = env.acc.allocator.env as any;

    if (!xe.designationEntries) xe.designationEntries = new Map<bigint, DesignationEntry>();

    // case 1: d == xs -> WHO
    const mem1 = new Uint8Array(BIG_ENOUGH_MEM); mem1.set(H1, HEAP);
    const st1 = runBlob(makeBlob(prog(xsId, HEAP), bitmask), GAS, { env, memInit: mem1 });
    expect(st1.registers[7]).toBe(WHO);

    // case 2: entry missing -> WHO
    const dId = 0xBBBn;
    const mem2 = new Uint8Array(BIG_ENOUGH_MEM); mem2.set(H1, HEAP);
    const st2 = runBlob(makeBlob(prog(dId, HEAP), bitmask), GAS, { env, memInit: mem2 });
    expect(st2.registers[7]).toBe(WHO);

    // case 3: dc != E32(xs) -> WHO
    // add entry but set boundCodeHash32 != H1
    const H2 = new Uint8Array(32).fill(0x99);
    const entry: DesignationEntry = { boundCodeHash32: H2, role: DESIGNATION_ROLE_EJECT, witnessBaseOffset: 81, witnessIndex: new Map() };
    (env.acc.allocator.env as any).designationEntries.set(dId, entry);

    const mem3 = new Uint8Array(BIG_ENOUGH_MEM); mem3.set(H1, HEAP); // memory has H1, entry has H2 => mismatch
    const st3 = runBlob(makeBlob(prog(dId, HEAP), bitmask), GAS, { env, memInit: mem3 });
    expect(st3.registers[7]).toBe(WHO);
  });


  it("HUH when role != 2 or witness (h,l) missing or timestamp too new", () => {
    const env = makeHostEnv({ accounts: new Map() }) as any;
    env.acc.allocator.env.currentServiceId = SVC_ID;

    // 32-byte witness payload in memory, also used to set the payers code hash
    const H = new Uint8Array(32).map((_, i) => (i * 7) & 0xff);
    const codeHash = le32ToBigInt(H);
    const dId = 42n;

    // xs with code-hash = E32(xs) = H
    const payer = mkService(SVC_ID, codeHash, 0n);
    env.putService(SVC_ID, payer);

    // d must exist AND have the same code-hash as xs
    // to pass the WHO guard; we want to fail on the role check instead.
    const dService = mkService(dId, codeHash, 0n);
    dService.lookupStorage = new Map(); // leave witness empty so the role check is the first failure
    env.acc.allocator.env.deltas.set(dId, dService);

    // designation entry with a bad role (!= 2) so eject handler returns HUH
    env.acc.allocator.env.designationEntries = new Map();
    env.acc.allocator.env.designationEntries.set(dId, {
      role: 1, // bad role
      boundCodeHash32: new Uint8Array(32),
      witnessBaseOffset: 0,
    });

    // init memory with the hash
    const mem = new Uint8Array(1 << 20);
    mem.set(H, HEAP);

    const st = runBlob(makeBlob(prog(dId, HEAP), bitmask), GAS, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(HUH);
  });


  function mkWitness(x: bigint, y: bigint): Uint8Array {
    const t = new Uint8Array(16);
    t.set(toLE(x, 8), 0);
    t.set(toLE(y, 8), 8);
    return t;
  }

  it("happy path: stages survivor in deltas and tombstones ejected id; persistent store unchanged", () => {
    // fixed time so y < t - D (D=19,200) is easy to satisfy
    const NOW = 100_000n - EJECT_DELAY;

    // set up current service (xs) and candidate (d)
    const xsId = SVC_ID;  // payer/current service
    const dId  = 42n;     // candidate service to eject

    const xsStartBal = 10n;
    const dStartBal  = 7n;
    const root = 0x1122n;        // same rootCodeHash required by gate

    const xs = mkService(xsId, root, xsStartBal);
    const d  = mkService(dId, root, dStartBal);

    const env = makeHostEnv({
      now: NOW,
      accounts: new Map<bigint, ServiceAccount>([
        [xsId, xs], // commited
        // d committed is OK, but eject requires it STAGED:
        [dId,  d],
      ]),
    });

    // Set current service id in the accumulation context
    env.acc.allocator.env.currentServiceId = xsId;

    // designation role comes from the *accumulation env* (xe.designationEntries), not the account
    env.acc.allocator.env.designationEntries ??= new Map<bigint, DesignationEntry>();
    env.acc.allocator.env.designationEntries.set(dId, {
      role: 2,
      boundCodeHash32: new Uint8Array(32),
      witnessBaseOffset: 0
    });

    // stage d, candidate must be in (xe).d
    env.acc.allocator.env.deltas.set(dId, d);

    const h = new Uint8Array(HASH_BYTES).map((_, i) => (i * 7) & 0xff);
    const mem = new Uint8Array(1 << 20);
    mem.set(h, HEAP);

    // Provide witness (h,l) -> [x,y] in d.lookupStorage; l = 0 because coresOffset=81
    const hKey = Buffer.from(h).toString("hex")
    const stagedD = env.acc.allocator.env.deltas.get(dId)!;
    ledgerPut(stagedD, hKey, 0, mkWitness(0n, 1n));

    const blob = makeBlob(prog(dId, HEAP), bitmask);
    const st = runBlob(blob, GAS, { env, memInit: mem });

    expect(st.exit?.type).toBe(ExitReasonType.Panic);
    expect(st.registers[7]).toBe(OK);

    //  persistent store remains unchanged
    const xsAfterPersist = env.getService(xsId)!;
    const dAfterPersist  = env.getService(dId)!;
    expect(xsAfterPersist.balance).toBe(xsStartBal);
    expect(dAfterPersist.balance).toBe(dStartBal);

    // staged updates live in the accumulation overlay
    const deltas = env.acc.allocator.env.deltas;
    const deleted = (env.acc.allocator.env as any).deleted as Set<bigint> | undefined;

    // survivor (xs) staged with increased balance
    const stagedXs = deltas.get(xsId) as ServiceAccount | undefined;
    expect(stagedXs).toBeDefined();
    expect(stagedXs!.balance).toBe(xsStartBal + dStartBal);

    // ejected id should be tombstoned
    expect(deleted).toBeDefined();
    expect(deleted!.has(dId)).toBe(true);
    expect(deltas.has(dId)).toBe(false);
  });
});
