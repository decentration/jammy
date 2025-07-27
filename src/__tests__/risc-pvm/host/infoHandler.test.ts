import { buildBlob }       from "../../../risc-pvm/interpreter/deblob";
import { makeHostEnv }     from "../../../risc-pvm/interpreter/host/hostEnvInterface";
import { Opcodes }         from "../../../risc-pvm/interpreter/instructions/opcodes";
import { runBlob }         from "../../../risc-pvm/interpreter/runBlob";
import { ExitReasonType }  from "../../../risc-pvm/interpreter/types";
import { NONE, OK, WHO }   from "../../../risc-pvm/interpreter/host/consts";

const DEST = 0x18000;

function prog(): Uint8Array {
  return Uint8Array.of(
    Opcodes.load_imm, 7, 0xff,0xff,0xff,0xff,
    Opcodes.load_imm, 8, DEST&255, DEST>>8&255, DEST>>16&255, DEST>>24&255,
    Opcodes.ecalli, 4,
    Opcodes.trap
  );
}

const bitmask = Uint8Array.of(0b0100_0001,0b0101_0000);

const blob = buildBlob({ meta:Uint8Array.of(0), jumpTbl:Uint8Array.of(0), z:1,
  instr:prog(), jumpEntries:[Uint8Array.of(0)], bitmaskBits:bitmask });

describe("ΩI info handler", () => {
  it("writes info blob, r7=OK", () => {
    const INFO = Uint8Array.from([1,2,3,4]);
    const env  = makeHostEnv({now: 0n, capBytes: Infinity, infoMap: new Map([
        ["18446744073709551615", // is the string key 0xffff_ffff_ffff_ffffn
            INFO]])}); 

    (env as any).encodeInfo = (x: Uint8Array)=>x;
    const st = runBlob(blob,100,{ env, memInit:new Uint8Array(1<<20) });

    expect(st.registers[7]).toBe(OK);
    expect(st.memory.slice(DEST,DEST+4)).toEqual(INFO);
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });

  it("no info -> r7=NONE", () => {
    const st = runBlob(blob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(NONE);
  });

  it("unknown service -> r7=WHO", () => {
    const bad = Uint8Array.from(prog()); bad[2]=1;
    const badBlob = buildBlob({meta:Uint8Array.of(0),jumpTbl:Uint8Array.of(0),z:1,
      instr:bad,jumpEntries:[Uint8Array.of(0)],bitmaskBits:bitmask});
    const st = runBlob(badBlob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.registers[7]).toBe(WHO);
  });

  it("dest unmapped -> Panic", () => {
    const bad = Uint8Array.from(prog()); bad[8]=0; bad[9]=0; // dest inside code
    const badBlob = buildBlob({meta:Uint8Array.of(0),jumpTbl:Uint8Array.of(0),z:1,
      instr:bad,jumpEntries:[Uint8Array.of(0)],bitmaskBits:bitmask});
    const st = runBlob(badBlob,100,{ env:makeHostEnv(), memInit:new Uint8Array(1<<20) });
    expect(st.exit?.type).toBe(ExitReasonType.Panic);
  });
});
