import { buildBlob }             from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv }           from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes }               from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }               from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }        from "../../../risc-pvm/interpreter/types";
import { FULL, WG, WX }                  from "../../../risc-pvm/interpreter/host/consts";

const DEST        = 0x18000;       // inside heap – mapped
const UNMAPPED   = 0x200000;       // > 1 MiB – unmapped


function makeCode(ptr: number, len = WG): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7, ptr&255, ptr>>8&255, ptr>>16&255, ptr>>24&255,
    Opcodes.load_imm, 8, len, 0,0,0,
    Opcodes.ecalli, 7,
    Opcodes.trap
  );
}
function makeBlob(code: Uint8Array): Uint8Array {
  const mask = Uint8Array.of(0b0100_0001, 0b0101_0000);
  return buildBlob({
    meta: Uint8Array.of(0), jumpTbl: Uint8Array.of(0), z:1,
    instr:code, jumpEntries:[Uint8Array.of(0)], bitmaskBits:mask
  });
}

describe("ΩE export handler", () => {

  it("happy‑path: segment pushed & r7==1", () => {
    const mem = new Uint8Array(1<<20);
    mem.set([1,2,3,4,5,6,7,8], DEST);

    const env = makeHostEnv({now: 0n, capBytes: Infinity, expOff: 0,  expSegs: []});
    const st  = runBlob(makeBlob(makeCode(DEST)),100n,{ env, memInit:mem });

    expect(st.registers[7]).toBe(1n);
    expect(env.exportSegments?.length).toBe(1);
    expect(env.exportSegments?.[0]!.slice(0,WG))
      .toEqual(mem.slice(DEST, DEST+WG));
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("unmapped memory: no segment, r7==ptr, Panic", () => {
    const mem = new Uint8Array(1<<20); // UNMAPPED not covered
    const env = makeHostEnv({now: 0n, capBytes: Infinity, expOff: 0,  expSegs: []});
    const st  = runBlob(makeBlob(makeCode(UNMAPPED)),100n,{ env, memInit:mem });

    expect(st.registers[7]).toBe(BigInt(UNMAPPED));   // unchanged
    expect(env.exportSegments?.length).toBe(0);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("export array full: r7==FULL, no new segment", () => {
    const mem = new Uint8Array(1<<20);
    mem.set([9,9,9,9,9,9,9,9], DEST);

    const filled = Array(WX).fill(new Uint8Array(WG)); // already full
    const env = makeHostEnv({now: 0n, capBytes: Infinity, expOff: 0,  expSegs: filled});


    const st = runBlob(makeBlob(makeCode(DEST)),100n,{ env, memInit:mem });

    expect(st.registers[7]).toBe(FULL);
    expect(env.exportSegments!.length).toBe(WX);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

});
