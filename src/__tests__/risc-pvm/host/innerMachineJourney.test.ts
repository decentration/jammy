import { buildBlob } from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv } from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes } from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob } from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType } from "../../../risc-pvm/interpreter/types";
import { OK, OOB, HUH, ZP, WHO } from "../../../risc-pvm/interpreter/host/consts";

const GAS      = 200;
const HEAP     = 0x18000;               // safe mapped area
const SRC      = HEAP + 0x100;          // outer source bytes
const DST      = HEAP + 0x200;          // outer dest bytes
const N        = 0;                     // machine id 0
const PAGE     = 16;                    // per spec: p ≥ 16
const C        = 1;                     // count pages
const R_ZERO_W = 2;                     // r=2: zero + W
const R_UP_R   = 3;                     // r=3: set R only (requires existing)
const R_UP_W   = 4;                     // r=4: set W only (requires existing)


function makeCode(r7:number, r8:number, r9:number, r10:number, sel: number) {
  return Uint8Array.of(
    Opcodes.load_imm, 7,  r7&255, r7>>>8&255, r7>>>16&255, r7>>>24&255,
    Opcodes.load_imm, 8,  r8&255, r8>>>8&255, r8>>>16&255, r8>>>24&255,
    Opcodes.load_imm, 9,  r9&255, r9>>>8&255, r9>>>16&255, r9>>>24&255,
    Opcodes.load_imm, 10, r10&255, r10>>>8&255, r10>>>16&255, r10>>>24&255,
    Opcodes.ecalli, sel, // ΩZ
  );
}


function withTrap(seq: Uint8Array) {
  return Uint8Array.of(...seq, Opcodes.trap);
}
const mask = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101,
                            0b0100_0001,0b0001_0000, 0b0001_0100,
                            0b0000_0100,0b0100_0001, 0b0101_0000); // 12 bytes

const makeBlob = (instr: Uint8Array, mask: Uint8Array) =>
  buildBlob({ meta: Uint8Array.of(0), jumpTbl: Uint8Array.of(0), z:1,
              instr, jumpEntries:[Uint8Array.of(0)], bitmaskBits: mask });

describe("inner memory journey: ΩZ -> ΩO -> ΩP", () => {
  it("alloc RW page, poke 4B, then peek them back", () => {
    const env = makeHostEnv({
      machines: new Map([[N, { p:new Uint8Array(), u:{ vPages:new Map(), aPages:new Map() }, i:0 }]])
    });

    const mem = new Uint8Array(1<<20);
    mem.set([9,9,9,9], SRC);

    // inner address
    const innerOff = PAGE * ZP + 4;

    // program: ΩZ(r=2) -> ΩO(write 4 bytes) -> ΩP(read 4 bytes to DST) -> trap
    const prog = withTrap(Uint8Array.of(
      ...makeCode(N, PAGE, C, R_ZERO_W, 11), // pages
      ...makeCode(N, SRC, innerOff, 4, 10),  // poke
      ...makeCode(N, DST, innerOff, 4, 9),   // peak
    ));

    const mask = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101,
        0b0100_0001,0b0001_0000, 0b0001_0100,
        0b0000_0100,0b0100_0001, 0b0101_0000);

    const st = runBlob(makeBlob(prog, mask), GAS, { env, memInit: mem });

    // last hostcall peek sets r7=OK
    expect(st.registers[7]).toBe(OK);

    // outer memory at DST now has what we poked in
    expect(st.memory.slice(DST, DST+4)).toEqual(Uint8Array.of(9,9,9,9));

    // program ends with trap
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("poke without ΩZ (no pages) -> OOB", () => {
    const env = makeHostEnv({
      machines: new Map([[N, { p:new Uint8Array(), u:{ vPages:new Map(), aPages:new Map() }, i:0 }]])
    });
    const mem = new Uint8Array(1<<20);
    mem.set([7,7,7,7], SRC);

    const innerOff = PAGE * ZP; // but we never allocated

    const mask = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);
    const st = runBlob(makeBlob(withTrap(makeCode(N, SRC, innerOff, 4, 10), ), mask), GAS, { env, memInit: mem });

    expect(st.registers[7]).toBe(OOB);  // inner not writable
  });

  it("ΩZ with r=3 on empty page -> HUH (must already exist)", () => {
    const env = makeHostEnv({
      machines: new Map([[N, { p:new Uint8Array(), u:{ vPages:new Map(), aPages:new Map() }, i:0 }]])
    });
    const mask = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);

    const st = runBlob(makeBlob(withTrap(makeCode(N, PAGE, 1, R_UP_R, 11)), mask), GAS, { env, memInit: new Uint8Array(1<<20) });

    expect(st.registers[7]).toBe(HUH);
  });

  it(" ΩZ Pages r=2 (create W), then pages r=3 (flip to R), then poke -> OOB; peek still OK", () => {
    const env = makeHostEnv({
      machines: new Map([[N, { p:new Uint8Array(), u:{ vPages:new Map(), aPages:new Map() }, i:0 }]])
    });
    const mem = new Uint8Array(1<<20);
    mem.set([5,5,5,5], SRC);

    const innerOff = PAGE * ZP + 8;

    // Pages(r=2) create + W, then Pages (r=3) set R, then try Poke (should OOB)
    const prog1 = withTrap(Uint8Array.of(
      ...makeCode(N, PAGE, 1, R_ZERO_W, 11), // Pages
      ...makeCode(N, PAGE, 1, R_UP_R, 11),   // Pages
      ...makeCode(N, SRC, innerOff, 4, 10),  // Poke
    ));
    const mask1 = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101,
        0b0100_0001,0b0001_0000, 0b0001_0100,
        0b0000_0100,0b0100_0001, 0b0101_0000);

    const st1 = runBlob(makeBlob(prog1, mask1), GAS, { env, memInit: mem });
    expect(st1.registers[7]).toBe(OOB); // write requires W

    const mask2 = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);

    // but Peek read should work (R pages are readable)
    const prog2 = withTrap(makeCode(N, DST, innerOff, 4, 9));
    const st2 = runBlob(makeBlob(prog2, mask2), GAS, { env, memInit: mem });
    expect(st2.registers[7]).toBe(OK);
  });
});

const innerCode = Uint8Array.of(Opcodes.trap);
const innerMask = Uint8Array.of(0b0000_0001); // opcode at byte 0
const innerBlob = buildBlob({
  meta: Uint8Array.of(0),
  jumpTbl: Uint8Array.of(0),
  z: 1,
  instr: innerCode,
  jumpEntries: [Uint8Array.of(0)],
  bitmaskBits: innerMask,
});


function makeCodeLoad3(r7:number, r8:number, r9:number, sel:number) {
    return Uint8Array.of(
      Opcodes.load_imm, 7,  r7 &255, r7>>8&255, r7>>16&255, r7>>24&255,
      Opcodes.load_imm, 8,  r8 &255, r8>>8&255, r8>>16&255, r8>>24&255,
      Opcodes.load_imm, 9,  r9 &255, r9>>8&255, r9>>16&255, r9>>24&255,
      Opcodes.ecalli, sel,
      Opcodes.trap
    );
  }

// ΩM=8, ΩP=9, ΩO=10, ΩZ=11
describe("Inner-machine journey: ΩM machine -> ΩZ pages -> ΩO poke -> ΩP peek", () => {
  it("allocates a page, pokes 4 bytes, then peeks them back", () => {
      const env = makeHostEnv();
      const mem = new Uint8Array(1<<20);
  
      // --- Step 1: ΩM create a machine with a minimal program blob in outer RAM ---
      {
        const mem = new Uint8Array(1<<20);
        mem.set(innerBlob, HEAP);

        const mask3 = Uint8Array.of(0b0100_0001,0b0001_0000,0b0001_0100);
        const code3 = makeCodeLoad3(HEAP, innerBlob.length, 0, 8); // r7=po, r8=pz, r9=i0; ΩM=8
        const blob3 = makeBlob(code3, mask3);
        const st   = runBlob(blob3, GAS, { env, memInit: mem });

        expect(st.exit?.type).toBe(ExitReasonType.Panic); // due to trap
        // r7 now holds machine id "n"
        expect(Number(st.registers[7])).toBe(0); // first ID will be 0
      }

      const n = 0;
      const page = 16; // p>=16 per spec
      const innerOff = page * ZP;

      // --- Step 2: ΩZ allocate page 16 as writeable (mode=2; zeroed) ---
      {
        const mem  = new Uint8Array(1<<20);
        const code = withTrap(Uint8Array.of(...makeCode(n, page, 1, 2, 11))); // r7=n, r8=p, r9=c, r10=r=2 (W); ΩZ=11

        const mask4 = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);



        const blob = makeBlob(code, mask4);
        const st   = runBlob(blob, GAS, { env, memInit: mem });

        expect(st.registers[7]).toBe(OK);
        expect(st.exit?.type).toBe(ExitReasonType.Panic);
      }

      // --- Step 3: ΩO poke 4 bytes from outer SRC -> inner offset page16*ZP ---
      {
        const mem = new Uint8Array(1<<20);
        mem.set([9,9,9,9], SRC);
        const code = withTrap(Uint8Array.of(...makeCode(n, SRC, innerOff, 4, 10))); // ΩO=10

        const mask4 = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);


        const blob = makeBlob(code, mask4);
        const st   = runBlob(blob, GAS, { env, memInit: mem });

        expect(st.registers[7]).toBe(OK);
        expect(st.exit?.type).toBe(ExitReasonType.Panic);
      }

      // --- Step 4: ΩP peek 4 bytes from inner offset -> outer DST ---
      {
        const mem  = new Uint8Array(1<<20);
        const code = withTrap(Uint8Array.of(...makeCode(n, DST, innerOff, 4, 9))); // ΩP=9

        const mask4 = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);


        const blob = makeBlob(code, mask4);
        const st   = runBlob(blob, GAS, { env, memInit: mem });

        expect(st.registers[7]).toBe(OK);
        expect(st.memory.slice(DST, DST+4)).toEqual(Uint8Array.of(9,9,9,9));
        expect(st.exit?.type).toBe(ExitReasonType.Panic);
      }

      // --- step 5: ΩX: expunge
      {
        const mask3 = Uint8Array.of(0b0100_0001,0b0001_0000,0b0001_0100); // 12 bytes
        const st = runBlob(makeBlob(makeCodeLoad3(n, 0, 0, 13), mask3), GAS, { env, memInit: mem }); // ΩX=13
        // r7 now holds the deleted machine's last i (implementation dependent), but just ensure no error:
        expect(st.exit?.type).toBe(ExitReasonType.Panic);
      }
      // ---- step 6: ΩP after expunge must see unknown machine -> WHO
      {
        const mask4 = Uint8Array.of( 0b0100_0001,0b0001_0000,0b0000_0100, 0b0000_0101);
        const code = withTrap(Uint8Array.of(...makeCode(n, DST, innerOff, 4, 9))); // ΩP=9
        const stP2 = runBlob(makeBlob(code, mask4), GAS, { env, memInit: mem });
        expect(stP2.registers[7]).toBe(WHO);
      }
      });
});
